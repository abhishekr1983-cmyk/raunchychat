import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { COUNTRIES } from '../../data/countries';
import { getStates } from '../../data/countryStates';

export default function GuestForm() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', gender: '', age: '', state: '', country: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleCountryChange = (e) => {
    setForm((f) => ({ ...f, country: e.target.value, state: '' }));
  };

  const states = getStates(form.country);

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
      <h2>Continue as Guest</h2>
      <p className="form-note">
        Adults 18+ only. We collect basic info so people know who they're chatting with.
      </p>
      {error && <div className="form-error">{error}</div>}
      <div className="form-row">
        <label>Username
          <input value={form.username} onChange={set('username')} minLength={3} maxLength={24} required autoFocus />
        </label>
        <label>Age
          <input type="number" value={form.age} onChange={set('age')} min={18} max={99} required placeholder="18+" />
        </label>
      </div>
      <label>Gender
        <select value={form.gender} onChange={set('gender')} required>
          <option value="">Select…</option>
          <option>Male</option>
          <option>Female</option>
          <option>Non-binary</option>
          <option>Prefer not to say</option>
        </select>
      </label>
      <label>Country
        <select value={form.country} onChange={handleCountryChange} required>
          <option value="">Select…</option>
          {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>State / Province
        {states ? (
          <select value={form.state} onChange={set('state')} required>
            <option value="">Select…</option>
            {states.map((s) => <option key={s}>{s}</option>)}
          </select>
        ) : (
          <input value={form.state} onChange={set('state')} placeholder="Enter your state or province" required />
        )}
      </label>
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? 'Joining…' : 'Enter as Guest'}
      </button>
    </form>
  );
}
