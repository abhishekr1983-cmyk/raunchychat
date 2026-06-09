import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error);
      login(data.token, data.user);
    } catch {
      setError('Network error, please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <h2>Sign In</h2>
      {error && <div className="form-error">{error}</div>}
      <label>Email
        <input type="email" value={form.email} onChange={set('email')} required autoFocus />
      </label>
      <label>Password
        <div className="pw-wrap">
          <input
            type={showPw ? 'text' : 'password'}
            value={form.password} onChange={set('password')} required
          />
          <button type="button" className="pw-eye" onClick={() => setShowPw((v) => !v)} tabIndex={-1}>
            {showPw ? '🙈' : '👁'}
          </button>
        </div>
      </label>
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
      <p className="form-switch">
        No account? <button type="button" className="link-btn" onClick={onSwitch}>Create one</button>
      </p>
    </form>
  );
}
