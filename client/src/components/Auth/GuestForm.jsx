import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function GuestForm() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', gender: '', age: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (Number(form.age) < 18) return setError('You must be at least 18 years old');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, age: Number(form.age) }),
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
      <h2>Enter as Guest</h2>
      <p className="form-note">Adults 18+ only. Pick a nickname and jump straight in — no email needed.</p>
      {error && <div className="form-error">{error}</div>}

      <label>Nickname
        <input
          value={form.username} onChange={set('username')}
          minLength={3} maxLength={24} required autoFocus
          placeholder="How should people call you?"
        />
      </label>

      <div className="form-row">
        <label>Gender
          <select value={form.gender} onChange={set('gender')} required>
            <option value="">Select…</option>
            <option>Male</option>
            <option>Female</option>
            <option>Non-binary</option>
            <option>Prefer not to say</option>
          </select>
        </label>
        <label>Age
          <input type="number" value={form.age} onChange={set('age')} min={18} max={99} required placeholder="18+" />
        </label>
      </div>

      <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
        {loading ? 'Joining…' : '🚀 Enter Chat'}
      </button>
    </form>
  );
}
