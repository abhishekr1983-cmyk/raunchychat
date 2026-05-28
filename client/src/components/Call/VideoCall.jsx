import { useEffect, useRef, useState } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function VideoCall({ peer, callType, isInitiator, socket, onEnd }) {
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidates = useRef([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState('Connecting…');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.onicecandidate = ({ candidate }) => {
          if (candidate) {
            socket.emit('webrtc-ice-candidate', { targetUserId: peer.id, candidate });
          }
        };

        pc.ontrack = ({ streams }) => {
          if (remoteRef.current) remoteRef.current.srcObject = streams[0];
          setStatus('Connected');
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') setStatus('Connected');
          if (pc.connectionState === 'failed') { cleanup(); onEnd(); }
        };

        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc-offer', { targetUserId: peer.id, offer });
        }
      } catch (err) {
        console.error('WebRTC init error:', err);
        if (!cancelled) { alert('Could not access camera/microphone.'); onEnd(); }
      }
    }

    init();

    async function handleOffer({ offer }) {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetUserId: peer.id, answer });
    }

    async function handleAnswer({ answer }) {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates.current = [];
    }

    async function handleIceCandidate({ candidate }) {
      const pc = pcRef.current;
      if (!pc || !candidate) return;
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCandidates.current.push(candidate);
      }
    }

    function handleCallEnded() { cleanup(); onEnd(); }

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    socket.on('call-ended', handleCallEnded);

    return () => {
      cancelled = true;
      cleanup();
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('call-ended', handleCallEnded);
    };
  }, []);

  function cleanup() {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
  }

  function endCall() {
    socket.emit('call-ended', { peerId: peer.id });
    cleanup();
    onEnd();
  }

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  }

  function toggleVideo() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoOff(!track.enabled); }
  }

  return (
    <div className="call-overlay">
      <div className="call-window">
        <div className="call-header">
          <span>{callType === 'video' ? '📹' : '📞'} {peer.username}</span>
          <span className={`call-status ${status === 'Connected' ? 'connected' : ''}`}>{status}</span>
        </div>

        {callType === 'video' ? (
          <div className="video-container">
            <video ref={remoteRef} autoPlay playsInline className="remote-video" />
            <video ref={localRef} autoPlay playsInline muted className="local-video" />
            {isVideoOff && <div className="video-off-overlay">Camera off</div>}
          </div>
        ) : (
          <div className="voice-container">
            <div className="voice-avatar">{peer.username?.[0]?.toUpperCase()}</div>
            <p className="voice-name">{peer.username}</p>
            <p className="voice-status">{status}</p>
            <audio ref={remoteRef} autoPlay />
          </div>
        )}

        <div className="call-controls">
          <button
            className={`ctrl-btn ${isMuted ? 'active' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          {callType === 'video' && (
            <button
              className={`ctrl-btn ${isVideoOff ? 'active' : ''}`}
              onClick={toggleVideo}
              title={isVideoOff ? 'Camera on' : 'Camera off'}
            >
              {isVideoOff ? '🚫' : '📹'}
            </button>
          )}
          <button className="ctrl-btn end-call-btn" onClick={endCall} title="End call">
            📵
          </button>
        </div>
      </div>
    </div>
  );
}
