import { useEffect, useState } from 'react';
import LoginForm from '../components/Auth/LoginForm';
import RegisterForm from '../components/Auth/RegisterForm';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { COUNTRIES } from '../data/countries';

// ── Main Landing page ─────────────────────────────────────────
export default function Landing() {
  const [modal, setModal] = useState(null); // 'login' | 'register'
  const [liveCount, setLiveCount] = useState(null);
  const { settings } = useSiteSettings();
  const { login } = useAuth();

  // Guest form state
  const [gender, setGender] = useState('Male');
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  const [guestError, setGuestError] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);

  // Fetch live online count on mount + refresh every 30s
  useEffect(() => {
    const load = () =>
      fetch('/api/stats')
        .then((r) => r.json())
        .then((d) => setLiveCount(d.online))
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const handleGuestSubmit = async (e) => {
    e.preventDefault();
    setGuestError('');
    if (!nickname.trim()) { setGuestError('Please enter a nickname'); return; }
    if (!age || Number(age) < 18 || Number(age) > 120) { setGuestError('Age must be 18 or older'); return; }
    if (!country) { setGuestError('Please select a country'); return; }

    setGuestLoading(true);
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nickname.trim(), gender, age: Number(age), state: 'N/A', country }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGuestError(data.error || 'Could not start session');
        // Clear nickname so user can pick a different one
        if (res.status === 409) setNickname('');
        return;
      }
      login(data.token, data.user);
    } catch {
      setGuestError('Server error, please try again');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="cb-landing">

      {/* ── Header ── */}
      <header className="cb-landing-header">
        <div className="cb-logo">
          <span className="cb-logo-icon">{settings.site_logo}</span>
          <span className="cb-logo-text">{settings.site_name}</span>
        </div>

        {liveCount !== null && (
          <div className="cb-live-badge">
            <span className="cb-live-dot" />
            <strong>{liveCount.toLocaleString()}</strong>&nbsp;online
          </div>
        )}

        <div className="cb-header-auth">
          <button className="btn btn-ghost btn-sm" onClick={() => setModal('login')}>Login</button>
          <button className="btn btn-primary btn-sm" onClick={() => setModal('register')}>Register</button>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="cb-hero">
        <h1 className="cb-hero-title">Chat with Strangers Worldwide</h1>
        <p className="cb-hero-sub">Meet new people, make friends, and have fun — for free.</p>

        {/* ── Entry card ── */}
        <div className="cb-entry-card">
          {guestError && <div className="form-error">{guestError}</div>}

          <form onSubmit={handleGuestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Gender */}
            <div>
              <div className="cb-field-label">I am a</div>
              <div className="cb-gender-row">
                <button
                  type="button"
                  className={`cb-gender-btn male ${gender === 'Male' ? 'active' : ''}`}
                  onClick={() => setGender('Male')}
                >
                  ♂ Male
                </button>
                <button
                  type="button"
                  className={`cb-gender-btn female ${gender === 'Female' ? 'active' : ''}`}
                  onClick={() => setGender('Female')}
                >
                  ♀ Female
                </button>
              </div>
            </div>

            {/* Nickname */}
            <div>
              <div className="cb-field-label">Nickname</div>
              <input
                className="cb-input"
                type="text"
                placeholder="Enter a nickname…"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={32}
                autoComplete="off"
              />
            </div>

            {/* Age + Country */}
            <div className="cb-row">
              <div>
                <div className="cb-field-label">Country</div>
                <select
                  className="cb-input"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="">Select country…</option>
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div className="cb-field-label">Age</div>
                <input
                  className="cb-input"
                  type="number"
                  placeholder="18+"
                  min={18}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="cb-start-btn" disabled={guestLoading}>
              {guestLoading ? 'Starting…' : 'Start Chatting →'}
            </button>
          </form>

          <p className="cb-disclaimer">🔞 Adults 18+ only · Guest sessions expire in 24h</p>
        </div>
      </div>

      {/* ── Auth modals ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            {modal === 'login' && <LoginForm onSwitch={() => setModal('register')} />}
            {modal === 'register' && <RegisterForm onSwitch={() => setModal('login')} />}
          </div>
        </div>
      )}
    </div>
  );
}
