import { useEffect, useRef } from 'react';

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageList({ messages, currentUserId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="message-list">
      {messages.map((msg) => {
        if (msg.system) {
          return (
            <div key={msg.id} className="message-system">
              {msg.content}
            </div>
          );
        }
        const isOwn = msg.user_id === currentUserId;
        return (
          <div key={msg.id} className={`message ${isOwn ? 'message-own' : 'message-other'}`}>
            {!isOwn && (
              <div className="message-avatar">{msg.username?.[0]?.toUpperCase()}</div>
            )}
            <div className="message-body">
              {!isOwn && (
                <div className="message-meta">
                  <span className="message-author">{msg.username}</span>
                  <span className="message-location">{msg.country}</span>
                </div>
              )}
              <div className="message-bubble">{msg.content}</div>
              <div className="message-time">{formatTime(msg.created_at)}</div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
