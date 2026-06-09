const jwt = require('jsonwebtoken');
const { client } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { BOTS } = require('../bots');

const socketToUser = new Map(); // socketId -> user
const userToSocket = new Map(); // userId -> socketId
const roomUsers = new Map();    // roomId -> Map<userId, user>

const GLOBAL_ROOM = 1;

// Pre-populate global room with all bots (negative IDs — never removed on disconnect)
roomUsers.set(GLOBAL_ROOM, new Map());
BOTS.forEach((bot) => roomUsers.get(GLOBAL_ROOM).set(bot.id, bot));
console.log(`[bots] ${BOTS.length} bots loaded into room ${GLOBAL_ROOM}`);

// Helper: total people visible in the global room (real + bots)
function roomOnlineCount() { return roomUsers.get(GLOBAL_ROOM)?.size ?? 0; }

// Tracks consecutive unanswered messages: `${senderId}-${receiverId}` -> count
const pendingCounts = new Map();

// Conference rooms: code → { name, creatorId, members: Map<socketId, userObj> }
const confRooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function pendingKey(a, b) { return `${a}-${b}`; }

// ── Word filter ────────────────────────────────────────────────
let blockedWordsCache = new Set();
let autoBlockThreshold = 3;

async function loadBlockedWords() {
  try {
    const result = await client.execute('SELECT word FROM blocked_words');
    blockedWordsCache = new Set(result.rows.map((r) => r.word.toLowerCase()));
    const setting = (await client.execute({
      sql: "SELECT value FROM site_settings WHERE key = 'auto_block_threshold'",
      args: [],
    })).rows[0];
    if (setting) autoBlockThreshold = Math.max(1, parseInt(setting.value) || 3);
    console.log(`[words] ${blockedWordsCache.size} blocked words loaded, threshold=${autoBlockThreshold}`);
  } catch (e) {
    console.warn('[words] Failed to load blocked words:', e.message);
  }
}

// Refresh called by admin routes when list changes
async function refreshBlockedWords() { await loadBlockedWords(); }

function matchBlockedWord(text) {
  const lower = text.toLowerCase();
  for (const word of blockedWordsCache) {
    if (lower.includes(word)) return word;
  }
  return null;
}

// ── Kick a user by userId (called from admin routes) ──────────
let _io = null;

function kickUser(userId, reason = 'Your account has been blocked by an administrator.') {
  if (!_io) return;
  const socketId = userToSocket.get(Number(userId));
  if (!socketId) return;
  const sock = _io.sockets.sockets.get(socketId);
  if (sock) {
    sock.emit('account-blocked', { reason });
    setTimeout(() => sock.disconnect(true), 600);
  }
}

// ─────────────────────────────────────────────────────────────
function setupSocketHandlers(io) {
  _io = io;
  // loadBlockedWords() is called from server/index.js after initDB() completes

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
          console.warn(`[auth] user ${userId} not found → auth-error`);
          return socket.emit('auth-error', 'User not found');
        }

        // Reject blocked accounts
        if (row.is_blocked) {
          console.warn(`[auth] blocked user ${row.username} attempted to connect`);
          return socket.emit('auth-error', 'Your account has been blocked.');
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

        socket.join(`room:${GLOBAL_ROOM}`);
        if (!roomUsers.has(GLOBAL_ROOM)) roomUsers.set(GLOBAL_ROOM, new Map());
        roomUsers.get(GLOBAL_ROOM).set(user.id, user);
        const usersInRoom = Array.from(roomUsers.get(GLOBAL_ROOM).values());
        io.to(`room:${GLOBAL_ROOM}`).emit('room-users', usersInRoom);
        socket.to(`room:${GLOBAL_ROOM}`).emit('user-joined', user);

        console.log(`[auth] ✓ ${user.username} (id=${user.id}) — ${usersInRoom.length} user(s)`);
        socket.emit('authenticated', user);
        io.emit('online-count', roomOnlineCount());
      } catch (e) {
        console.warn(`[auth] invalid token:`, e.message);
        socket.emit('auth-error', 'Invalid token');
      }
    });

    // ── Room presence ──────────────────────────────────────────

    socket.on('join-room', (roomId) => {
      const user = socketToUser.get(socket.id);
      if (!user) return;
      socket.join(`room:${roomId}`);
      if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
      roomUsers.get(roomId).set(user.id, user);
      const usersInRoom = Array.from(roomUsers.get(roomId).values());
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

    // ── Private messaging ──────────────────────────────────────

    socket.on('open-conversation', async ({ withUserId }) => {
      const user = socketToUser.get(socket.id);
      if (!user) return;

      // Bot IDs are negative — client loads from sessionStorage, nothing to do here
      if (withUserId < 0) return;

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

      // Convert BigInt values to Number so socket.io can serialize them
      const messages = result.rows.map((row) => ({
        id:          Number(row.id),
        sender_id:   Number(row.sender_id),
        receiver_id: Number(row.receiver_id),
        content:     row.content,
        created_at:  row.created_at,
        sender_name: row.sender_name,
      }));

      const myPending = pendingCounts.get(pendingKey(user.id, withUserId)) || 0;
      socket.emit('conversation-history', {
        withUserId,
        messages,
        pendingCount: myPending,
      });
    });

    socket.on('private-message', async ({ toUserId, content }) => {
      try {
      const sender = socketToUser.get(socket.id);
      if (!sender || !content?.trim()) return;

      console.log(`[msg] ${sender.username}(${sender.id}) → ${toUserId}: "${content?.slice(0,40)}"`);

      // Check if sender account is blocked in DB (could have been blocked mid-session)
      const senderRow = (await client.execute({
        sql: 'SELECT is_blocked, violation_count FROM users WHERE id = ?',
        args: [sender.id],
      })).rows[0];

      if (senderRow?.is_blocked) {
        socket.emit('account-blocked', { reason: 'Your account has been blocked.' });
        return;
      }

      // ── Word filter ──────────────────────────────────────────
      const trimmed = content.trim();
      const matched = matchBlockedWord(trimmed);
      if (matched) {
        // Increment violation count
        await client.execute({
          sql: 'UPDATE users SET violation_count = violation_count + 1 WHERE id = ?',
          args: [sender.id],
        });
        const updatedRow = (await client.execute({
          sql: 'SELECT violation_count FROM users WHERE id = ?',
          args: [sender.id],
        })).rows[0];
        const newCount = Number(updatedRow?.violation_count || 1);
        const willAutoBlock = newCount >= autoBlockThreshold;

        if (willAutoBlock) {
          await client.execute({
            sql: 'UPDATE users SET is_blocked = 1 WHERE id = ?',
            args: [sender.id],
          });
        }

        // Log the violation
        await client.execute({
          sql: 'INSERT INTO violations (user_id, username, matched_word, message, auto_blocked) VALUES (?, ?, ?, ?, ?)',
          args: [sender.id, sender.username, matched, trimmed.slice(0, 500), willAutoBlock ? 1 : 0],
        });

        if (willAutoBlock) {
          socket.emit('account-blocked', {
            reason: `Your account has been automatically blocked after repeated violations.`,
          });
          setTimeout(() => socket.disconnect(true), 600);
        } else {
          socket.emit('word-violation', {
            matched,
            violationCount: newCount,
            threshold: autoBlockThreshold,
            remaining: autoBlockThreshold - newCount,
          });
        }
        return; // message NOT delivered
      }

      // ── Bot messaging: unlimited, echo only — bots never reply ──
      if (toUserId < 0) {
        const safe = trimmed.slice(0, 2000);
        socket.emit('new-private-message', {
          id: Date.now(),
          sender_id: sender.id,
          receiver_id: toUserId,
          sender_name: sender.username,
          content: safe,
          created_at: new Date().toISOString(),
        });
        return;
      }

      // ── Pending count check ──────────────────────────────────
      const key = pendingKey(sender.id, toUserId);
      const count = pendingCounts.get(key) || 0;
      if (count >= 3) {
        socket.emit('message-blocked', { toUserId });
        return;
      }

      const safe = trimmed.slice(0, 2000);
      const result = await client.execute({
        sql: 'INSERT INTO private_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
        args: [sender.id, toUserId, safe],
      });

      pendingCounts.set(pendingKey(toUserId, sender.id), 0);
      pendingCounts.set(key, count + 1);

      const message = {
        id: Number(result.lastInsertRowid),
        sender_id: sender.id,
        receiver_id: toUserId,
        sender_name: sender.username,
        content: safe,
        created_at: new Date().toISOString(),
      };

      socket.emit('new-private-message', message);
      const targetSocketId = userToSocket.get(toUserId);
      if (targetSocketId) io.to(targetSocketId).emit('new-private-message', message);

      // Signal both sides to refresh their recent-chats list
      socket.emit('refresh-recent-chats');
      if (targetSocketId) io.to(targetSocketId).emit('refresh-recent-chats');
      console.log(`[msg] saved id=${message.id}`);

      } catch (err) {
        console.error('[private-message] ERROR:', err.message, err.stack);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Call signaling ─────────────────────────────────────────

    socket.on('call-request', ({ targetUserId, callType }) => {
      const caller = socketToUser.get(socket.id);
      if (!caller) return;
      // Bots have no socket — treat same as offline user
      if (targetUserId < 0) return socket.emit('call-error', 'User is not available');
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

    // ── WebRTC signaling ───────────────────────────────────────

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

    // ── Recent chat history ────────────────────────────────────

    socket.on('get-recent-chats', async () => {
      const user = socketToUser.get(socket.id);
      if (!user) return;

      try {
        // Get the most recent message per unique conversation partner
        const result = await client.execute({
          sql: `
            WITH convos AS (
              SELECT
                CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS other_id,
                content, sender_id, created_at,
                ROW_NUMBER() OVER (
                  PARTITION BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
                  ORDER BY created_at DESC
                ) AS rn
              FROM private_messages
              WHERE (sender_id = ? OR receiver_id = ?)
                AND sender_id > 0 AND receiver_id > 0
            )
            SELECT c.other_id, c.content, c.sender_id, c.created_at,
                   u.username, u.gender, u.age, u.state, u.country
            FROM convos c
            JOIN users u ON u.id = c.other_id
            WHERE c.rn = 1
            ORDER BY c.created_at DESC
            LIMIT 30
          `,
          args: [user.id, user.id, user.id, user.id],
        });

        const chats = result.rows.map((row) => ({
          user: {
            id: Number(row.other_id),
            username: row.username,
            gender: row.gender,
            age: Number(row.age),
            state: row.state,
            country: row.country,
          },
          lastMessage: row.content,
          lastTime: row.created_at,
          isOwn: Number(row.sender_id) === user.id,
        }));

        socket.emit('recent-chats', chats);
      } catch (e) {
        console.warn('[recent-chats] error:', e.message);
        socket.emit('recent-chats', []);
      }
    });

    // ── Typing indicators ──────────────────────────────────────

    socket.on('typing-start', ({ toUserId }) => {
      const sender = socketToUser.get(socket.id);
      if (!sender || toUserId < 0) return;
      const targetSocketId = userToSocket.get(toUserId);
      if (targetSocketId) io.to(targetSocketId).emit('user-typing', { userId: sender.id });
    });

    socket.on('typing-stop', ({ toUserId }) => {
      const sender = socketToUser.get(socket.id);
      if (!sender || toUserId < 0) return;
      const targetSocketId = userToSocket.get(toUserId);
      if (targetSocketId) io.to(targetSocketId).emit('user-stop-typing', { userId: sender.id });
    });

    // ── Admin: bot controls ────────────────────────────────────

    socket.on('admin-clear-bots', () => {
      const admin = socketToUser.get(socket.id);
      if (!admin?.isAdmin) return;
      const room = roomUsers.get(GLOBAL_ROOM);
      if (!room) return;
      let removed = 0;
      for (const [id] of room) { if (id < 0) { room.delete(id); removed++; } }
      io.to(`room:${GLOBAL_ROOM}`).emit('room-users', Array.from(room.values()));
      io.emit('online-count', roomOnlineCount());
      socket.emit('bots-status', { active: false, count: 0 });
      console.log(`[admin] ${admin.username} removed ${removed} bots`);
    });

    socket.on('admin-restore-bots', () => {
      const admin = socketToUser.get(socket.id);
      if (!admin?.isAdmin) return;
      const room = roomUsers.get(GLOBAL_ROOM);
      if (!room) return;
      BOTS.forEach((bot) => room.set(bot.id, bot));
      io.to(`room:${GLOBAL_ROOM}`).emit('room-users', Array.from(room.values()));
      io.emit('online-count', roomOnlineCount());
      socket.emit('bots-status', { active: true, count: BOTS.length });
      console.log(`[admin] ${admin.username} restored ${BOTS.length} bots`);
    });

    socket.on('admin-get-bots-status', () => {
      const admin = socketToUser.get(socket.id);
      if (!admin?.isAdmin) return;
      const room = roomUsers.get(GLOBAL_ROOM);
      const activeCount = room ? [...room.keys()].filter((id) => id < 0).length : 0;
      socket.emit('bots-status', { active: activeCount > 0, count: activeCount });
    });

    // ── Conference rooms ────────────────────────────────────────

    socket.on('create-conference', ({ name }) => {
      const user = socketToUser.get(socket.id);
      if (!user) return;

      // Generate unique code
      let code;
      do { code = generateRoomCode(); } while (confRooms.has(code));

      const roomName = (name || `${user.username}'s Room`).slice(0, 50);
      // Room starts empty — creator joins from the new tab via join-conference
      confRooms.set(code, { name: roomName, creatorId: user.id, members: new Map() });

      socket.emit('conference-created', { code, name: roomName });
      console.log(`[conf] ${user.username} created room ${code}`);
    });

    socket.on('join-conference', ({ code }) => {
      const user = socketToUser.get(socket.id);
      if (!user) return;

      const room = confRooms.get(code?.toUpperCase());
      if (!room) return socket.emit('conf-error', 'Room not found. Check the code and try again.');
      if (room.members.size >= 5) return socket.emit('conf-error', 'Room is full (maximum 5 participants).');
      if (room.members.has(socket.id)) return socket.emit('conf-error', 'Already in this room.');

      socket.join(`conf:${code}`);
      room.members.set(socket.id, user);

      // Notify existing members that a new peer joined
      socket.to(`conf:${code}`).emit('conf-peer-joined', {
        socketId: socket.id,
        userId: user.id,
        username: user.username,
        gender: user.gender,
      });

      // Send current member list to new joiner
      const memberList = [...room.members.entries()]
        .filter(([sid]) => sid !== socket.id)
        .map(([sid, u]) => ({ socketId: sid, userId: u.id, username: u.username, gender: u.gender }));

      socket.emit('conference-joined', { code, name: room.name, members: memberList });
      console.log(`[conf] ${user.username} joined room ${code} (${room.members.size}/5)`);
    });

    socket.on('leave-conference', ({ code }) => {
      const user = socketToUser.get(socket.id);
      if (!user) return;
      const room = confRooms.get(code);
      if (room) {
        room.members.delete(socket.id);
        if (room.members.size === 0) {
          confRooms.delete(code);
          console.log(`[conf] Room ${code} closed (empty)`);
        }
      }
      socket.leave(`conf:${code}`);
      io.to(`conf:${code}`).emit('conf-peer-left', { socketId: socket.id });
    });

    // WebRTC signaling for conference
    socket.on('conf-offer', ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit('conf-offer', { fromSocketId: socket.id, offer });
    });
    socket.on('conf-answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('conf-answer', { fromSocketId: socket.id, answer });
    });
    socket.on('conf-ice', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('conf-ice', { fromSocketId: socket.id, candidate });
    });

    // ── Disconnect ─────────────────────────────────────────────

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
      io.emit('online-count', roomOnlineCount());
      // Clean up conference rooms
      confRooms.forEach((room, code) => {
        if (room.members.has(socket.id)) {
          room.members.delete(socket.id);
          io.to(`conf:${code}`).emit('conf-peer-left', { socketId: socket.id });
          if (room.members.size === 0) confRooms.delete(code);
        }
      });
    });
  });
}

function getOnlineCount() { return roomOnlineCount(); }

module.exports = { setupSocketHandlers, kickUser, refreshBlockedWords, getOnlineCount };
