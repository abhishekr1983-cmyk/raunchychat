import { useEffect, useRef, useState } from 'react';
import { getFlag } from '../../utils/flags';

const MAX_PENDING = 3;

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getAvatarColor(gender) {
  if (gender === 'Female') return 'var(--avatar-female, #e91e8c)';
  if (gender === 'Male') return 'var(--avatar-male, #1e88e5)';
  return 'var(--accent)';
}

export default function PrivateChat({ peer, socket, currentUser, onClose, onCall, callState, onBack }) {
  const [messages, setMessages] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const remaining = MAX_PENDING - pendingCount;
  const isBlocked = pendingCount >= MAX_PENDING;

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
      } else {
        setPendingCount((p) => Math.min(p + 1, MAX_PENDING));
      }
    };

    const handleBlocked = ({ toUserId }) => {
      if (toUserId === peer.id) setPendingCount(MAX_PENDING);
    };

    socket.on('conversation-history', handleHistory);
    socket.on('new-private-message', handleNewMessage);
    socket.on('message-blocked', handleBlocked);

    return () => {
      socket.off('conversation-history', handleHistory);
      socket.off('new-private-message', handleNewMessage);
      socket.off('message-blocked', handleBlocked);
    };
  }, [peer.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    inputRef.current?.focus();
  }, [peer.id]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || isBlocked) return;
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
              {peer.gender} · {peer.age} Yrs · {peer.state}, {peer.country}
            </div>
          </div>
        </div>
        <div className="pc-header-actions">
          <button
            className="pc-action-btn"
            title="Voice call"
            disabled={!canCall}
            onClick={() => onCall(peer, 'voice')}
          >📞</button>
          <button
            className="pc-action-btn"
            title="Video call"
            disabled={!canCall}
            onClick={() => onCall(peer, 'video')}
          >📹</button>
          <button className="pc-action-btn pc-close-btn" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="pc-messages">
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
                  <div className={`pc-bubble ${isOwn ? 'own' : 'other'}`}>
                    {msg.content}
                  </div>
                  <div className={`pc-msg-meta ${isOwn ? 'own' : ''}`}>
                    <span className="pc-time">{formatTime(msg.created_at)}</span>
                    {isOwn && <span className="pc-check">✓✓</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Footer / input ── */}
      <div className="pc-footer">
        {isBlocked ? (
          <div className="pc-blocked">
            ⏳ You've sent 3 messages. Wait for <strong>{peer.username}</strong> to reply.
          </div>
        ) : (
          <>
            {pendingCount > 0 && (
              <div className="pc-limit-bar">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`pc-dot ${i < pendingCount ? 'used' : ''}`} />
                ))}
                <span className="pc-limit-text">
                  {remaining} message{remaining !== 1 ? 's' : ''} left before waiting for reply
                </span>
              </div>
            )}
            <div className="pc-input-bar">
              <input
                ref={inputRef}
                className="pc-input"
                placeholder={`Message ${peer.username}…`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                maxLength={2000}
              />
              <div className="pc-input-icons">
                <button className="pc-icon-btn" title="Emoji">😊</button>
              </div>
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
