const jwt = require('jsonwebtoken');
const { client } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const socketToUser = new Map(); // socketId -> user
const userToSocket = new Map(); // userId -> socketId
const roomUsers = new Map();    // roomId -> Map<userId, user>

const GLOBAL_ROOM = 1; // single global room — everyone lands here on auth

// Tracks consecutive unanswered messages: `${senderId}-${receiverId}` -> count
const pendingCounts = new Map();

function pendingKey(a, b) { return `${a}-${b}`; }

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {

    console.log(`[socket] connect  ${socket.id}`);

    socket.on('authenticate', async (token) => {
      try {
        const { userId } = jwt.verify(token, JWT_SECRET);
        const row = (await client.execute({
          sql: 'SELECT * FROM users WHERE id = ?',
          args: [userId],
        })).rows[0];

        if (!row) {
          console.warn(`[auth] user ${userId} not found in DB → auth-error`);
          return socket.emit('auth-error', 'User not found');
        }

        const user = {
          id: Number(row.id),
          username: row.username,
          gender: row.gender,
          age: Number(row.age),
          state: row.state,
          country: row.country,
          isGuest: row.is_guest === 1,
          isAdmin: row.is_admin === 1,
        };

        const oldSock = userToSocket.get(user.id);
        if (oldSock && oldSock !== socket.id) socketToUser.delete(oldSock);

        socketToUser.set(socket.id, user);
        userToSocket.set(user.id, socket.id);

        // ── Auto-join global room immediately after auth ──────────
        // Do this BEFORE emitting 'authenticated' so the client's
        // room-users handler fires in the same tick as auth confirmation,
        // eliminating any client→server join-room round-trip race.
        socket.join(`room:${GLOBAL_ROOM}`);
        if (!roomUsers.has(GLOBAL_ROOM)) roomUsers.set(GLOBAL_ROOM, new Map());
        roomUsers.get(GLOBAL_ROOM).set(user.id, user);
        const usersInRoom = Array.from(roomUsers.get(GLOBAL_ROOM).values());
        // Full list to everyone already in the room (including this user)
        io.to(`room:${GLOBAL_ROOM}`).emit('room-users', usersInRoom);
        // Single-user event to everyone ELSE (so their handleUserJoined fires)
        socket.to(`room:${GLOBAL_ROOM}`).emit('user-joined', user);

        console.log(`[auth] ✓ ${user.username} (id=${user.id}) joined room — ${usersInRoom.length} user(s): ${usersInRoom.map(u => u.username).join(', ')}`);
        socket.emit('authenticated', user);
        io.emit('online-count', userToSocket.size);
      } catch (e) {
        console.warn(`[auth] invalid token:`, e.message);
        socket.emit('auth-error', 'Invalid token');
      }
    });

    // ── Room presence (no chat, presence only) ──────────────────

    socket.on('join-room', (roomId) => {
      const user = socketToUser.get(socket.id);
      if (!user) {
        console.warn(`[join-room] socket ${socket.id} not authenticated, ignoring`);
        return;
      }

      socket.join(`room:${roomId}`);
      if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
      roomUsers.get(roomId).set(user.id, user);

      const usersInRoom = Array.from(roomUsers.get(roomId).values());
      console.log(`[join-room] ${user.username} joined room ${roomId} — ${usersInRoom.length} user(s): ${usersInRoom.map(u => u.username).join(', ')}`);
      io.to(`room:${roomId}`).emit('room-users', usersInRoom);
      socket.to(`room:${roomId}`).emit('user-joined', user);
    });

    socket.on('leave-room', (roomId) => {
      const user = socketToUser.get(socket.id);
      if (!user) return;

      socket.leave(`room:${roomId}`);
      if (roomUsers.has(roomId)) {
        roomUsers.get(roomId).delete(user.id);
        io.to(`room:${roomId}`).emit('room-users', Array.from(roomUsers.get(roomId).values()));
      }
      socket.to(`room:${roomId}`).emit('user-left', user);
    });

    // ── Private messaging ───────────────────────────────────────

    socket.on('open-conversation', async ({ withUserId }) => {
      const user = socketToUser.get(socket.id);
      if (!user) return;

      const result = await client.execute({
        sql: `
          SELECT pm.id, pm.sender_id, pm.receiver_id, pm.content, pm.created_at,
                 s.username AS sender_name
          FROM private_messages pm
          JOIN users s ON pm.sender_id = s.id
          WHERE (pm.sender_id = ? AND pm.receiver_id = ?)
             OR (pm.sender_id = ? AND pm.receiver_id = ?)
          ORDER BY pm.created_at ASC
          LIMIT 200
        `,
        args: [user.id, withUserId, withUserId, user.id],
      });

      const myPending = pendingCounts.get(pendingKey(user.id, withUserId)) || 0;

      socket.emit('conversation-history', {
        withUserId,
        messages: result.rows,
        pendingCount: myPending,
      });
    });

    socket.on('private-message', async ({ toUserId, content }) => {
      const sender = socketToUser.get(socket.id);
      if (!sender || !content?.trim()) return;

      const key = pendingKey(sender.id, toUserId);
      const count = pendingCounts.get(key) || 0;

      if (count >= 3) {
        socket.emit('message-blocked', { toUserId });
        return;
      }

      const trimmed = content.trim().slice(0, 2000);
      const result = await client.execute({
        sql: 'INSERT INTO private_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
        args: [sender.id, toUserId, trimmed],
      });

      // Sending to B resets B's blocked count toward A (sender is responding to B)
      pendingCounts.set(pendingKey(toUserId, sender.id), 0);
      // Increment sender's own count toward B
      pendingCounts.set(key, count + 1);

      const message = {
        id: Number(result.lastInsertRowid),
        sender_id: sender.id,
        receiver_id: toUserId,
        sender_name: sender.username,
        content: trimmed,
        created_at: new Date().toISOString(),
      };

      socket.emit('new-private-message', message);

      const targetSocketId = userToSocket.get(toUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('new-private-message', message);
      }
    });

    // ── Call signaling ──────────────────────────────────────────

    socket.on('call-request', ({ targetUserId, callType }) => {
      const caller = socketToUser.get(socket.id);
      if (!caller) return;
      const targetSocketId = userToSocket.get(targetUserId);
      if (!targetSocketId) return socket.emit('call-error', 'User is not available');
      io.to(targetSocketId).emit('incoming-call', {
        callerId: caller.id, callerName: caller.username,
        callerGender: caller.gender, callType,
      });
    });

    socket.on('call-accepted', ({ callerId, callType }) => {
      const accepter = socketToUser.get(socket.id);
      if (!accepter) return;
      const callerSocketId = userToSocket.get(callerId);
      if (!callerSocketId) return;
      io.to(callerSocketId).emit('call-accepted', {
        accepterId: accepter.id, accepterName: accepter.username, callType,
      });
    });

    socket.on('call-rejected', ({ callerId }) => {
      const rejecter = socketToUser.get(socket.id);
      if (!rejecter) return;
      const callerSocketId = userToSocket.get(callerId);
      if (!callerSocketId) return;
      io.to(callerSocketId).emit('call-rejected', { name: rejecter.username });
    });

    socket.on('call-ended', ({ peerId }) => {
      const ender = socketToUser.get(socket.id);
      if (!ender) return;
      const peerSocketId = userToSocket.get(peerId);
      if (!peerSocketId) return;
      io.to(peerSocketId).emit('call-ended', { enderId: ender.id });
    });

    // ── WebRTC signaling ────────────────────────────────────────

    socket.on('webrtc-offer', ({ targetUserId, offer }) => {
      const sender = socketToUser.get(socket.id);
      if (!sender) return;
      const targetSocketId = userToSocket.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('webrtc-offer', { offer, callerId: sender.id });
    });

    socket.on('webrtc-answer', ({ targetUserId, answer }) => {
      const sender = socketToUser.get(socket.id);
      if (!sender) return;
      const targetSocketId = userToSocket.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('webrtc-answer', { answer, answererId: sender.id });
    });

    socket.on('webrtc-ice-candidate', ({ targetUserId, candidate }) => {
      const targetSocketId = userToSocket.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('webrtc-ice-candidate', { candidate });
    });

    // ── Disconnect ──────────────────────────────────────────────

    socket.on('disconnect', () => {
      const user = socketToUser.get(socket.id);
      if (!user) return;
      console.log(`[socket] disconnect ${user.username} (id=${user.id})`);
      socketToUser.delete(socket.id);
      userToSocket.delete(user.id);
      roomUsers.forEach((users, roomId) => {
        if (users.has(user.id)) {
          users.delete(user.id);
          io.to(`room:${roomId}`).emit('room-users', Array.from(users.values()));
          io.to(`room:${roomId}`).emit('user-left', user);
        }
      });
      io.emit('online-count', userToSocket.size);
    });
  });
}

module.exports = { setupSocketHandlers };
