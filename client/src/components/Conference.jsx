import { useEffect, useRef, useState, useCallback } from 'react';
import { getAvatarStyle, getInitial } from '../utils/avatar';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

function VideoTile({ stream, username, isLocal, videoOff, muted: selfMuted }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  const showVideo = stream && (!isLocal || !videoOff);
  return (
    <div className="conf-tile">
      {showVideo
        ? <video ref={ref} autoPlay playsInline muted={isLocal || selfMuted} className="conf-video" />
        : <div className="conf-avatar-wrap"><div className="conf-avatar" style={getAvatarStyle(username)}>{getInitial(username)}</div></div>
      }
      <div className="conf-tile-name">{username}{isLocal ? ' (You)' : ''}</div>
    </div>
  );
}

export default function Conference({ socket, currentUser, initialCode, initialName, initialMembers, onLeave }) {
  const [members, setMembers] = useState(initialMembers || []);
  const [streams, setStreams] = useState({});       // socketId → MediaStream
  const [localStream, setLocalStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mediaError, setMediaError] = useState('');

  const localStreamRef = useRef(null);
  const peers = useRef({});

  const createPeer = useCallback(async (targetSocketId, isInitiator) => {
    if (peers.current[targetSocketId]) return peers.current[targetSocketId];
    const pc = new RTCPeerConnection(ICE);
    peers.current[targetSocketId] = pc;

    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('conf-ice', { targetSocketId, candidate });
    };
    pc.ontrack = ({ streams: [s] }) => {
      setStreams(prev => ({ ...prev, [targetSocketId]: s }));
    };

    if (isInitiator) {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socket.emit('conf-offer', { targetSocketId, offer });
    }
    return pc;
  }, [socket]);

  // Get user media on mount, then connect to existing members
  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);
        // New joiner initiates connections to all existing members
        (initialMembers || []).forEach(m => createPeer(m.socketId, true));
      })
      .catch(() => {
        // Fall back to audio only
        navigator.mediaDevices.getUserMedia({ video: false, audio: true })
          .then(stream => {
            if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
            localStreamRef.current = stream;
            setLocalStream(stream);
            setVideoOff(true);
            setMediaError('Camera not available — voice only');
            (initialMembers || []).forEach(m => createPeer(m.socketId, true));
          })
          .catch(() => { if (mounted) setMediaError('Microphone access denied'); });
      });
    return () => {
      mounted = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peers.current).forEach(pc => pc.close());
    };
  }, []);

  useEffect(() => {
    const onPeerJoined = ({ socketId, userId, username, gender }) => {
      setMembers(prev => prev.some(m => m.socketId === socketId) ? prev : [...prev, { socketId, userId, username, gender }]);
      // Existing member waits for offer from new joiner (non-initiator)
      createPeer(socketId, false);
    };
    const onOffer = async ({ fromSocketId, offer }) => {
      const pc = await createPeer(fromSocketId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('conf-answer', { targetSocketId: fromSocketId, answer });
    };
    const onAnswer = async ({ fromSocketId, answer }) => {
      const pc = peers.current[fromSocketId];
      if (pc && pc.signalingState !== 'stable') await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };
    const onIce = async ({ fromSocketId, candidate }) => {
      const pc = peers.current[fromSocketId];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    };
    const onPeerLeft = ({ socketId }) => {
      setMembers(prev => prev.filter(m => m.socketId !== socketId));
      setStreams(prev => { const n = { ...prev }; delete n[socketId]; return n; });
      peers.current[socketId]?.close();
      delete peers.current[socketId];
    };
    const onError = ({ message }) => alert(`Conference error: ${message}`);

    socket.on('conf-peer-joined', onPeerJoined);
    socket.on('conf-offer', onOffer);
    socket.on('conf-answer', onAnswer);
    socket.on('conf-ice', onIce);
    socket.on('conf-peer-left', onPeerLeft);
    socket.on('conf-error', onError);
    return () => {
      socket.off('conf-peer-joined', onPeerJoined);
      socket.off('conf-offer', onOffer);
      socket.off('conf-answer', onAnswer);
      socket.off('conf-ice', onIce);
      socket.off('conf-peer-left', onPeerLeft);
      socket.off('conf-error', onError);
    };
  }, [socket, createPeer]);

  const toggleMute = () => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMuted(m => !m); }
  };
  const toggleVideo = () => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setVideoOff(v => !v); }
  };
  const leave = () => {
    socket.emit('leave-conference', { code: initialCode });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peers.current).forEach(pc => pc.close());
    onLeave();
  };
  const copyCode = () => {
    navigator.clipboard.writeText(initialCode).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const all = [{ socketId: 'local', username: currentUser.username, isLocal: true }, ...members];

  return (
    <div className="conf-overlay">
      <div className="conf-topbar">
        <div className="conf-room-info">
          <span className="conf-room-name">{initialName}</span>
          <span className="conf-member-count">{all.length}/5</span>
        </div>
        <div className="conf-code-row">
          <span className="conf-code-label">Code:</span>
          <span className="conf-code-val">{initialCode}</span>
          <button className="conf-copy-btn" onClick={copyCode}>{copied ? '✓ Copied!' : 'Copy'}</button>
        </div>
      </div>

      {mediaError && <div className="conf-media-warn">⚠ {mediaError}</div>}

      <div className={`conf-grid conf-n${all.length}`}>
        {all.map(({ socketId, username, isLocal }) => (
          <VideoTile
            key={socketId}
            stream={isLocal ? localStream : streams[socketId]}
            username={username}
            isLocal={isLocal}
            videoOff={isLocal ? videoOff : false}
            muted={isLocal ? muted : false}
          />
        ))}
      </div>

      <div className="conf-controls">
        <button className={`conf-ctrl-btn ${muted ? 'off' : ''}`} onClick={toggleMute}>
          {muted ? '🔇' : '🎤'}<span>{muted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button className={`conf-ctrl-btn ${videoOff ? 'off' : ''}`} onClick={toggleVideo}>
          {videoOff ? '📵' : '📹'}<span>{videoOff ? 'Start Video' : 'Stop Video'}</span>
        </button>
        <button className="conf-ctrl-btn conf-leave" onClick={leave}>
          📞<span>Leave</span>
        </button>
      </div>
    </div>
  );
}
