import { useEffect, useRef, useState } from 'react';
import LoginForm from '../components/Auth/LoginForm';
import RegisterForm from '../components/Auth/RegisterForm';
import GuestForm from '../components/Auth/GuestForm';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { COUNTRIES } from '../data/countries';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

// ── Telegram profile completion modal ─────────────────────────
function TelegramProfileModal({ pendingAuth, onComplete, onCancel }) {
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!age || !country) { setErr('Please fill all fields'); return; }
    if (Number(age) < 18 || Number(age) > 120) { setErr('Age must be 18 or older'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pendingAuth.token}` },
        body: JSON.stringify({ gender, age: Number(age), state: 'N/A', country }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error); return; }
      onComplete(pendingAuth.token, data.user);
    } catch { setErr('Server error, please try again'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>✈️</div>
          <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}>Welcome via Telegram!</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text2)' }}>
            Hi <strong>{pendingAuth.user.username}</strong>! Quick profile setup before you enter.
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {err && <div className="form-error">{err}</div>}
          <label>
            Gender
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              {GENDERS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label>
            Age
            <input
              type="number" min={18} max={120} placeholder="e.g. 25"
              value={age} onChange={(e) => setAge(e.target.value)}
            />
          </label>
          <label>
            Country
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Enter Chat →'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}
            style={{ alignSelf: 'center' }}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Landing page ─────────────────────────────────────────
export default function Landing() {
  const [modal, setModal] = useState(null); // 'login' | 'register' | 'guest'
  const [telegramPending, setTelegramPending] = useState(null); // { token, user }
  const [tgLoading, setTgLoading] = useState(false);
  const [tgError, setTgError] = useState('');
  const [liveCount, setLiveCount] = useState(null);
  const { settings } = useSiteSettings();
  const { login } = useAuth();
  const tgRef = useRef(null);

  // Fetch live online count on mount + refresh every 30s
  useEffect(() => {
    const load = () => fetch('/api/stats').then((r) => r.json()).then((d) => setLiveCount(d.online)).catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  // Inject Telegram Login Widget when bot username is configured
  useEffect(() => {
    const botUsername = settings.telegram_bot_username?.trim();
    if (!botUsername || !tgRef.current) return;

    // Global callback called by the Telegram widget
    window.onTelegramAuth = async (userData) => {
      setTgLoading(true);
      setTgError('');
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData),
        });
        const data = await res.json();
        if (!res.ok) { setTgError(data.error || 'Telegram login failed'); return; }

        if (data.isNewUser) {
          // New user — show profile completion before entering chat
          setTelegramPending({ token: data.token, user: data.user });
        } else {
          login(data.token, data.user);
        }
      } catch { setTgError('Could not connect to server'); }
      setTgLoading(false);
    };

    // Inject the Telegram widget script (replaces any previous one)
    tgRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    tgRef.current.appendChild(script);

    return () => { delete window.onTelegramAuth; };
  }, [settings.telegram_bot_username]);

  const channelLink = settings.telegram_channel_link?.trim();
  const hasTelegram = !!settings.telegram_bot_username?.trim();

  return (
    <div className="landing">

      {/* Telegram channel banner */}
      {channelLink && (
        <a className="tg-channel-banner" href={channelLink} target="_blank" rel="noopener noreferrer">
          <span className="tg-channel-icon">✈️</span>
          Join our Telegram Community
          <span className="tg-channel-arrow">→</span>
        </a>
      )}

      <div className="landing-hero">
        <div className="landing-logo">{settings.site_logo}</div>
        <h1 className="landing-title">{settings.site_name}</h1>
        <p className="landing-subtitle">
          {settings.site_tagline || 'Adults only. Flirt, connect, and get wild with real people — chat, voice, or video.'}
        </p>

        {/* Live count badge */}
        {liveCount !== null && (
          <div className="landing-live-count">
            <span className="landing-live-dot" />
            <strong>{liveCount.toLocaleString()}</strong> people online right now
          </div>
        )}

        {/* Guest-first CTA */}
        <div className="landing-actions">
          <button className="btn btn-primary btn-lg landing-guest-btn" onClick={() => setModal('guest')}>
            🚀 Enter as Guest — Free &amp; Instant
          </button>
          <div className="landing-actions-secondary">
            <button className="btn btn-secondary btn-lg" onClick={() => setModal('register')}>
              Create Account
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => setModal('login')}>
              Sign In
            </button>
          </div>
        </div>

        {/* Telegram login */}
        {hasTelegram && (
          <div className="tg-login-section">
            <div className="tg-login-divider"><span>or</span></div>
            <div ref={tgRef} className="tg-widget-container" />
            {tgLoading && <p className="tg-login-status">Verifying with Telegram…</p>}
            {tgError && <p className="tg-login-error">{tgError}</p>}
          </div>
        )}

        <p className="landing-note">
          🔞 Adults only — you must be 18+ to enter. Guest sessions expire after 24 hours.
        </p>
      </div>

      <div className="landing-features">
        <div className="feature-card">
          <span className="feature-icon">🌶️</span>
          <h3>Adult Chat Rooms</h3>
          <p>Themed rooms packed with adults ready to connect.</p>
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
        {hasTelegram && (
          <div className="feature-card">
            <span className="feature-icon">✈️</span>
            <h3>Telegram Login</h3>
            <p>Already on Telegram? Join instantly with one click — no registration.</p>
          </div>
        )}
      </div>

      {/* Standard auth modals */}
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

      {/* Telegram profile completion modal */}
      {telegramPending && (
        <TelegramProfileModal
          pendingAuth={telegramPending}
          onComplete={(token, user) => { login(token, user); setTelegramPending(null); }}
          onCancel={() => setTelegramPending(null)}
        />
      )}
    </div>
  );
}
