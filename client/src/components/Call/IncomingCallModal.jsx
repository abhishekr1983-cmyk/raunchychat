export default function IncomingCallModal({ caller, onAccept, onReject }) {
  const icon = caller.callType === 'video' ? '📹' : '📞';

  return (
    <div className="modal-overlay">
      <div className="modal call-modal">
        <div className="call-modal-icon">{icon}</div>
        <h3>Incoming {caller.callType} call</h3>
        <p className="call-modal-caller">
          <strong>{caller.username}</strong>
          {caller.gender && ` · ${caller.gender}`}
        </p>
        <div className="call-modal-actions">
          <button className="btn btn-danger" onClick={onReject}>
            Decline
          </button>
          <button className="btn btn-success" onClick={onAccept}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
