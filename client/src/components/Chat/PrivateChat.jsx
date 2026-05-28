import { useEffect, useRef, useState } from 'react';

const MAX_PENDING = 3;

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PrivateChat({ peer, socket, currentUser, onClose }) {
  const [messages, setMessages] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

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
        // deduplicate by id
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      if (msg.sender_id === peer.id) {
        // peer replied → unblock us
        setPendingCount(0);
      } else {
        // we sent → increment
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

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || isBlocked) return;
    socket.emit('private-message', { toUserId: peer.id, content: trimmed });
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="private-chat">
      <div className="pc-header">
        <div className="pc-peer-info">
          <div className="pc-avatar">{peer.username[0].toUpperCase()}</div>
          <div>
            <div className="pc-peer-name">{peer.username}</div>
            <div className="pc-peer-meta">{peer.age} · {peer.gender} · {peer.country}</div>
          </div>
        </div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      <div className="pc-messages">
        {messages.length === 0 && (
          <div className="pc-empty">Say hi to {peer.username} 👋</div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentUser.id;
          return (
            <div key={msg.id} className={`pc-msg ${isOwn ? 'pc-msg-own' : 'pc-msg-other'}`}>
              <div className="pc-bubble">{msg.content}</div>
              <div className="pc-time">{formatTime(msg.created_at)}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="pc-footer">
        {isBlocked ? (
          <div className="pc-blocked">
            <span>⏳ You've sent 3 messages. Wait for {peer.username} to reply before sending more.</span>
          </div>
        ) : (
          <>
            <div className="pc-limit-bar">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`pc-dot ${i < pendingCount ? 'used' : ''}`} />
              ))}
              <span className="pc-limit-text">
                {remaining === 3
                  ? 'Start the conversation'
                  : `${remaining} message${remaining !== 1 ? 's' : ''} left before waiting for reply`}
              </span>
            </div>
            <div className="pc-input-row">
              <textarea
                className="pc-input"
                placeholder={`Message ${peer.username}…`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={2000}
              />
              <button
                className="btn btn-primary send-btn"
                onClick={send}
                disabled={!text.trim()}
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
