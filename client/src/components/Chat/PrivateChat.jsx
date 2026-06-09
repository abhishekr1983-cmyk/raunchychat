import { useEffect, useRef, useState } from 'react';
import { getFlag } from '../../utils/flags';
import { useSocket } from '../../contexts/SocketContext';

const MAX_PENDING = 3;

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getAvatarColor(gender) {
  if (gender === 'Female') return 'var(--avatar-female, #e91e8c)';
  if (gender === 'Male') return 'var(--avatar-male, #1e88e5)';
  return 'var(--accent)';
}

function playPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* browser blocked autoplay */ }
}

export default function PrivateChat({ peer, socket, currentUser, onClose, onCall, callState, onBack }) {
  const [messages, setMessages] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [text, setText] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const typingOutTimer = useRef(null);
  const peerTypingTimer = useRef(null);
  const isSendingTyping = useRef(false);
  const originalTitle = useRef(document.title);
  const { wordViolation, clearWordViolation } = useSocket();

  const remaining = MAX_PENDING - pendingCount;
  const isBlocked = pendingCount >= MAX_PENDING;

  // ── Message history + socket events ──────────────────────────
  useEffect(() => {
    socket.emit('open-conversation', { withUserId: peer.id });

    const handleHistory = ({ withUserId, messages: msgs, pendingCount: pc }) => {
      if (withUserId !== peer.id) return;
      setMessages(msgs);
      setPendingCount(pc);
    };

    const handleNewMessage = (msg) => {
      const isOurConvo =
        (msg.sender_id === peer.id && msg.receiver_id === currentUser.id) ||
        (msg.sender_id === currentUser.id && msg.receiver_id === peer.id);
      if (!isOurConvo) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      if (msg.sender_id === peer.id) {
        setPendingCount(0);
        setPeerTyping(false);
        // Notify if tab is hidden
        if (document.hidden) {
          playPing();
          document.title = `💬 ${peer.username} sent a message`;
        }
      } else {
        setPendingCount((p) => Math.min(p + 1, MAX_PENDING));
      }
    };

    const handleBlocked = ({ toUserId }) => {
      if (toUserId === peer.id) setPendingCount(MAX_PENDING);
    };

    const handleTyping = ({ userId }) => {
      if (userId !== peer.id) return;
      setPeerTyping(true);
      clearTimeout(peerTypingTimer.current);
      peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 3000);
    };

    const handleStopTyping = ({ userId }) => {
      if (userId !== peer.id) return;
      setPeerTyping(false);
    };

    socket.on('conversation-history', handleHistory);
    socket.on('new-private-message', handleNewMessage);
    socket.on('message-blocked', handleBlocked);
    socket.on('user-typing', handleTyping);
    socket.on('user-stop-typing', handleStopTyping);

    return () => {
      socket.off('conversation-history', handleHistory);
      socket.off('new-private-message', handleNewMessage);
      socket.off('message-blocked', handleBlocked);
      socket.off('user-typing', handleTyping);
      socket.off('user-stop-typing', handleStopTyping);
      clearTimeout(peerTypingTimer.current);
      clearTimeout(typingOutTimer.current);
    };
  }, [peer.id]);

  // Reset tab title when window gets focus
  useEffect(() => {
    const reset = () => { document.title = originalTitle.current; };
    window.addEventListener('focus', reset);
    return () => window.removeEventListener('focus', reset);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => { inputRef.current?.focus(); }, [peer.id]);

  const handleScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  // ── Typing emit ───────────────────────────────────────────────
  const handleInput = (e) => {
    setText(e.target.value);
    if (peer.id < 0) return; // don't emit typing to bots
    if (!isSendingTyping.current) {
      isSendingTyping.current = true;
      socket.emit('typing-start', { toUserId: peer.id });
    }
    clearTimeout(typingOutTimer.current);
    typingOutTimer.current = setTimeout(() => {
      isSendingTyping.current = false;
      socket.emit('typing-stop', { toUserId: peer.id });
    }, 2000);
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || isBlocked) return;
    // Stop typing indicator
    clearTimeout(typingOutTimer.current);
    isSendingTyping.current = false;
    if (peer.id > 0) socket.emit('typing-stop', { toUserId: peer.id });
    socket.emit('private-message', { toUserId: peer.id, content: trimmed });
    setText('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const canCall = !callState;

  return (
    <div className="private-chat">

      {/* ── Chat header ── */}
      <div className="pc-header">
        <div className="pc-header-left">
          {onBack && (
            <button className="pc-mobile-back" onClick={onBack} title="Back">←</button>
          )}
          <div className="pc-avatar-lg" style={{ background: getAvatarColor(peer.gender) }}>
            {peer.username[0].toUpperCase()}
          </div>
          <div className="pc-peer-details">
            <div className="pc-peer-name-row">
              {peer.isAdmin && <span className="pc-admin-crown" title="Admin">👑</span>}
              <span className="pc-peer-name">{peer.username}</span>
              <span className="pc-flag">{getFlag(peer.country)}</span>
            </div>
            <div className="pc-peer-meta">
              {peerTyping
                ? <span className="pc-typing-status">typing…</span>
                : <><span className="pc-online-dot" />Online · {peer.age} Yrs · {peer.state}, {peer.country}</>}
            </div>
          </div>
        </div>
        <div className="pc-header-actions">
          <button className="pc-action-btn" title="Voice call" disabled={!canCall} onClick={() => onCall(peer, 'voice')}>📞</button>
          <button className="pc-action-btn" title="Video call" disabled={!canCall} onClick={() => onCall(peer, 'video')}>📹</button>
          <button className="pc-action-btn pc-close-btn" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="pc-messages" ref={messagesRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="pc-empty">
            <div className="pc-empty-avatar" style={{ background: getAvatarColor(peer.gender) }}>
              {peer.username[0].toUpperCase()}
            </div>
            <p>Say hi to <strong>{peer.username}</strong> 👋</p>
            <p className="pc-empty-sub">{peer.age} yrs · {peer.state}, {peer.country}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUser.id;
            return (
              <div key={msg.id} className={`pc-msg-row ${isOwn ? 'own' : 'other'}`}>
                {!isOwn && (
                  <div className="pc-msg-avatar" style={{ background: getAvatarColor(peer.gender) }}>
                    {peer.username[0].toUpperCase()}
                  </div>
                )}
                <div className="pc-msg-body">
                  <div className={`pc-bubble ${isOwn ? 'own' : 'other'}`}>{msg.content}</div>
                  <div className={`pc-msg-meta ${isOwn ? 'own' : ''}`}>
                    <span className="pc-time">{formatTime(msg.created_at)}</span>
                    {isOwn && <span className="pc-check">✓✓</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing bubble */}
        {peerTyping && (
          <div className="pc-msg-row other">
            <div className="pc-msg-avatar" style={{ background: getAvatarColor(peer.gender) }}>
              {peer.username[0].toUpperCase()}
            </div>
            <div className="pc-typing-bubble">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollBtn && (
        <button className="pc-scroll-btn" onClick={scrollToBottom} title="Scroll to bottom">↓</button>
      )}

      {/* ── Footer / input ── */}
      <div className="pc-footer">
        {wordViolation && (
          <div className="pc-violation-banner">
            ⚠️ Message blocked — your message contained a prohibited word (<strong>{wordViolation.matched}</strong>).
            {' '}{wordViolation.remaining} warning{wordViolation.remaining !== 1 ? 's' : ''} left before your account is suspended.
            <button className="pc-violation-close" onClick={clearWordViolation}>✕</button>
          </div>
        )}
        {isBlocked && peer.id > 0 ? (
          <div className="pc-blocked">
            ⏳ You've sent 3 messages. Wait for <strong>{peer.username}</strong> to reply.
          </div>
        ) : (
          <>
            <div className="pc-input-bar">
              <input
                ref={inputRef}
                className="pc-input"
                placeholder={`Message ${peer.username}…`}
                value={text}
                onChange={handleInput}
                onKeyDown={onKeyDown}
                maxLength={2000}
              />
              <button
                className="pc-send-btn"
                onClick={send}
                disabled={!text.trim()}
              >
                SEND
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
