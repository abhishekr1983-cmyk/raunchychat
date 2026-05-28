export default function UserList({ users, currentUserId, onVoiceCall, onVideoCall, inCall }) {
  return (
    <ul className="user-list">
      {users.map((u) => {
        const isMe = u.id === currentUserId;
        return (
          <li key={u.id} className="user-item">
            <div className="user-item-avatar">{u.username?.[0]?.toUpperCase()}</div>
            <div className="user-item-info">
              <span className="user-item-name">
                {u.username} {isMe && <span className="you-badge">You</span>}
              </span>
              <span className="user-item-meta">{u.age} · {u.gender} · {u.country}</span>
            </div>
            {!isMe && (
              <div className="user-call-btns">
                <button
                  className="call-btn voice"
                  title="Voice call"
                  disabled={inCall}
                  onClick={() => onVoiceCall(u)}
                >
                  📞
                </button>
                <button
                  className="call-btn video"
                  title="Video call"
                  disabled={inCall}
                  onClick={() => onVideoCall(u)}
                >
                  📹
                </button>
              </div>
            )}
          </li>
        );
      })}
      {users.length === 0 && <li className="user-item-empty">No one else here yet</li>}
    </ul>
  );
}
