import { useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="message-input-bar">
      <textarea
        className="message-input"
        placeholder={disabled ? 'Connecting…' : 'Type a message… (Enter to send)'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        rows={1}
        maxLength={2000}
      />
      <button className="btn btn-primary send-btn" onClick={send} disabled={disabled || !text.trim()}>
        Send
      </button>
    </div>
  );
}
