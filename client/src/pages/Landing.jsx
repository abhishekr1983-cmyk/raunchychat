import { useState } from 'react';
import LoginForm from '../components/Auth/LoginForm';
import RegisterForm from '../components/Auth/RegisterForm';
import GuestForm from '../components/Auth/GuestForm';
import ThemeSelector from '../components/ThemeSelector';

export default function Landing() {
  const [modal, setModal] = useState(null); // 'login' | 'register' | 'guest'

  return (
    <div className="landing">
      <div className="landing-theme-btn"><ThemeSelector /></div>
      <div className="landing-hero">
        <div className="landing-logo">🔥</div>
        <h1 className="landing-title">RaunchyChat</h1>
        <p className="landing-subtitle">
          Adults only. Flirt, connect, and get wild with real people around the world — chat, voice, or video.
        </p>
        <div className="landing-actions">
          <button className="btn btn-primary btn-lg" onClick={() => setModal('register')}>
            Create Account
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => setModal('login')}>
            Sign In
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => setModal('guest')}>
            Continue as Guest
          </button>
        </div>
        <p className="landing-note">
          🔞 Adults only — you must be 18+ to enter. Guest sessions expire after 24 hours.
        </p>
      </div>

      <div className="landing-features">
        <div className="feature-card">
          <span className="feature-icon">🌶️</span>
          <h3>Adult Chat Rooms</h3>
          <p>8 themed rooms packed with adults ready to get wild.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">📞</span>
          <h3>Private Voice Calls</h3>
          <p>One-on-one voice calls — whisper or be loud, no one else hears.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">📹</span>
          <h3>Private Video Calls</h3>
          <p>Face-to-face video, peer-to-peer encrypted. Just the two of you.</p>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            {modal === 'login' && <LoginForm onSwitch={() => setModal('register')} />}
            {modal === 'register' && <RegisterForm onSwitch={() => setModal('login')} />}
            {modal === 'guest' && <GuestForm />}
          </div>
        </div>
      )}
    </div>
  );
}
