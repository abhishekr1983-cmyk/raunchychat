import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAvatarStyle, getInitial } from '../../utils/avatar';
import { getFlag } from '../../utils/flags';
import { COUNTRIES } from '../../data/countries';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const RELATIONSHIP_OPTS = ['Single', 'Taken', 'Married', 'Open relationship', "It's complicated", 'Prefer not to say'];
const ORIENTATION_OPTS  = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Curious', 'Prefer not to say'];
const BODY_OPTS         = ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Plus-size', 'Prefer not to say'];
const LOOKING_OPTS      = ['Friendship', 'Casual chat', 'Dating', 'Relationship', 'Flirting', 'Roleplay', 'Just here for fun'];
const INTEREST_SUGGEST  = [
  'Music', 'Movies', 'Travel', 'Gaming', 'Fitness', 'Cooking', 'Reading', 'Art',
  'Photography', 'Dancing', 'Sports', 'Fashion', 'Nature', 'Technology', 'Pets',
  'Yoga', 'Coffee', 'Netflix', 'Nightlife', 'Foodie',
];

/* ── Tag input (interests / languages) ── */
function TagInput({ label, tags, setTags, suggestions = [], max = 15, placeholder }) {
  const [input, setInput] = useState('');
  const add = (val) => {
    const v = val.trim();
    if (!v || tags.includes(v) || tags.length >= max) return;
    setTags([...tags, v]);
    setInput('');
  };
  return (
    <div className="pf-field">
      <label className="pf-label">{label} <span className="pf-count">{tags.length}/{max}</span></label>
      <div className="pf-tag-box">
        {tags.map((t) => (
          <span key={t} className="pf-tag">
            {t}
            <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>✕</button>
          </span>
        ))}
        <input
          className="pf-tag-input"
          value={input}
          placeholder={tags.length === 0 ? placeholder : ''}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
            else if (e.key === 'Backspace' && !input && tags.length) setTags(tags.slice(0, -1));
          }}
        />
      </div>
      {suggestions.length > 0 && tags.length < max && (
        <div className="pf-suggest">
          {suggestions.filter((s) => !tags.includes(s)).slice(0, 12).map((s) => (
            <button type="button" key={s} className="pf-suggest-chip" onClick={() => add(s)}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Multi-select chips (looking for) ── */
function ChipSelect({ label, options, selected, setSelected, max = 7 }) {
  const toggle = (o) => {
    if (selected.includes(o)) setSelected(selected.filter((x) => x !== o));
    else if (selected.length < max) setSelected([...selected, o]);
  };
  return (
    <div className="pf-field">
      <label className="pf-label">{label}</label>
      <div className="pf-chips">
        {options.map((o) => (
          <button type="button" key={o}
            className={`pf-chip ${selected.includes(o) ? 'active' : ''}`}
            onClick={() => toggle(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProfileModal({ mode, viewUserId, onClose, onMessage }) {
  const { user, token, updateUser } = useAuth();
  const isEdit = mode === 'edit';

  const [data, setData] = useState(isEdit ? user : null);
  const [loading, setLoading] = useState(!isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstField = useRef(null);

  // Form state (edit mode)
  const [form, setForm] = useState(() => isEdit ? {
    gender: user.gender || 'Prefer not to say',
    age: user.age || 18,
    country: user.country || '',
    state: user.state || '',
    bio: user.bio || '',
    interests: user.interests || [],
    lookingFor: user.lookingFor || [],
    relationshipStatus: user.relationshipStatus || '',
    orientation: user.orientation || '',
    languages: user.languages || [],
    bodyType: user.bodyType || '',
    height: user.height || '',
  } : null);

  // View mode — fetch the profile
  useEffect(() => {
    if (isEdit) return;
    setLoading(true);
    fetch(`/api/auth/profile/${viewUserId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setData(d.user);
        else setError(d.error || 'Profile not found');
      })
      .catch(() => setError('Could not load profile'))
      .finally(() => setLoading(false));
  }, [isEdit, viewUserId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, age: Number(form.age) }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Failed to save'); return; }
      updateUser(d.user);
      onClose();
    } catch { setError('Network error, please try again'); }
    finally { setSaving(false); }
  };

  const p = data || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {/* ── Header ── */}
        <div className="pf-header">
          <div className="pf-avatar" style={getAvatarStyle(p.username || user?.username || '?')}>
            {p.avatarEmoji || getInitial(p.username || user?.username || '?')}
          </div>
          <div className="pf-head-info">
            <div className="pf-head-name">
              {p.username || user?.username}
              {p.isAdmin && <span title="Admin">👑</span>}
            </div>
            {!isEdit && (
              <div className="pf-head-sub">
                {p.gender} · {p.age} · {p.state ? `${p.state}, ` : ''}{p.country} {getFlag(p.country)}
              </div>
            )}
            {isEdit && <div className="pf-head-sub">Edit your profile</div>}
          </div>
        </div>

        {error && <div className="form-error" style={{ margin: '0 0 12px' }}>{error}</div>}

        {/* ── VIEW MODE ── */}
        {!isEdit && (
          loading ? (
            <div className="pf-loading"><div className="conf-spinner" /></div>
          ) : (
            <div className="pf-view">
              {p.bio && <p className="pf-bio">“{p.bio}”</p>}

              {p.lookingFor?.length > 0 && (
                <div className="pf-view-row">
                  <span className="pf-view-label">Looking for</span>
                  <div className="pf-chips">
                    {p.lookingFor.map((x) => <span key={x} className="pf-chip active">{x}</span>)}
                  </div>
                </div>
              )}

              {p.interests?.length > 0 && (
                <div className="pf-view-row">
                  <span className="pf-view-label">Interests</span>
                  <div className="pf-tag-box readonly">
                    {p.interests.map((x) => <span key={x} className="pf-tag readonly">{x}</span>)}
                  </div>
                </div>
              )}

              <div className="pf-view-grid">
                {p.relationshipStatus && <div><span className="pf-view-label">Status</span><div>{p.relationshipStatus}</div></div>}
                {p.orientation && <div><span className="pf-view-label">Orientation</span><div>{p.orientation}</div></div>}
                {p.bodyType && <div><span className="pf-view-label">Body type</span><div>{p.bodyType}</div></div>}
                {p.height && <div><span className="pf-view-label">Height</span><div>{p.height}</div></div>}
              </div>

              {p.languages?.length > 0 && (
                <div className="pf-view-row">
                  <span className="pf-view-label">Languages</span>
                  <div>{p.languages.join(', ')}</div>
                </div>
              )}

              {onMessage && (
                <button className="btn btn-primary" style={{ marginTop: 8, justifyContent: 'center' }}
                  onClick={() => { onMessage(p); onClose(); }}>
                  💬 Message {p.username}
                </button>
              )}
            </div>
          )
        )}

        {/* ── EDIT MODE ── */}
        {isEdit && form && (
          <div className="pf-edit">
            <div className="pf-field">
              <label className="pf-label">About me <span className="pf-count">{form.bio.length}/500</span></label>
              <textarea ref={firstField} className="pf-textarea" rows={3} maxLength={500}
                placeholder="Tell people a bit about yourself…"
                value={form.bio} onChange={set('bio')} />
            </div>

            <div className="pf-row3">
              <div className="pf-field">
                <label className="pf-label">Gender</label>
                <select className="pf-input" value={form.gender} onChange={set('gender')}>
                  {GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="pf-field">
                <label className="pf-label">Age</label>
                <input className="pf-input" type="number" min={18} max={120} value={form.age} onChange={set('age')} />
              </div>
              <div className="pf-field">
                <label className="pf-label">Height</label>
                <input className="pf-input" placeholder="e.g. 175 cm" value={form.height} onChange={set('height')} />
              </div>
            </div>

            <div className="pf-row2">
              <div className="pf-field">
                <label className="pf-label">Country</label>
                <select className="pf-input" value={form.country} onChange={set('country')}>
                  <option value="">Select…</option>
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="pf-field">
                <label className="pf-label">State / Region</label>
                <input className="pf-input" placeholder="Optional" value={form.state} onChange={set('state')} />
              </div>
            </div>

            <ChipSelect label="Looking for" options={LOOKING_OPTS}
              selected={form.lookingFor} setSelected={(v) => setForm((f) => ({ ...f, lookingFor: v }))} />

            <TagInput label="Interests & hobbies" tags={form.interests}
              setTags={(v) => setForm((f) => ({ ...f, interests: v }))}
              suggestions={INTEREST_SUGGEST} max={15} placeholder="Type and press Enter…" />

            <div className="pf-row2">
              <div className="pf-field">
                <label className="pf-label">Relationship status</label>
                <select className="pf-input" value={form.relationshipStatus} onChange={set('relationshipStatus')}>
                  <option value="">Prefer not to say</option>
                  {RELATIONSHIP_OPTS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="pf-field">
                <label className="pf-label">Orientation</label>
                <select className="pf-input" value={form.orientation} onChange={set('orientation')}>
                  <option value="">Prefer not to say</option>
                  {ORIENTATION_OPTS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div className="pf-field">
              <label className="pf-label">Body type</label>
              <select className="pf-input" value={form.bodyType} onChange={set('bodyType')}>
                <option value="">Prefer not to say</option>
                {BODY_OPTS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>

            <TagInput label="Languages" tags={form.languages}
              setTags={(v) => setForm((f) => ({ ...f, languages: v }))}
              suggestions={['English', 'Hindi', 'Spanish', 'French', 'Arabic', 'Bengali', 'Tamil', 'Telugu']}
              max={10} placeholder="Languages you speak…" />

            <div className="pf-actions">
              <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
