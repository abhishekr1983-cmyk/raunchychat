import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { useSocket } from '../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Users tab ──────────────────────────────────────────────────
function UsersTab({ token }) {
  const [userType, setUserType] = useState('registered');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams({ type: userType, page, limit: 50 });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json());
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }, [userType, search, page, token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); }, [userType, search]);

  const handleSearchSubmit = (e) => { e.preventDefault(); setSearch(searchInput); };

  const blockUser = async (userId, block) => {
    setActionLoading(userId);
    try {
      await fetch(`/api/admin/users/${userId}/${block ? 'block' : 'unblock'}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch { alert('Action failed'); }
    setActionLoading(null);
  };

  const deleteUser = async (userId, username) => {
    if (!confirm(`Delete user "${username}" permanently? This cannot be undone.`)) return;
    setActionLoading(userId);
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch { alert('Delete failed'); }
    setActionLoading(null);
  };

  const isGuests = userType === 'guest';

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <span className="admin-section-icon">👥</span>
        <span className="admin-section-title">Users</span>
        {data && <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text2)' }}>{data.total} total</span>}
      </div>
      <div className="admin-section-body">
        <div className="admin-users-toolbar">
          <select className="admin-users-type" value={userType} onChange={(e) => setUserType(e.target.value)}>
            <option value="registered">Registered</option>
            <option value="guest">Guests</option>
            <option value="blocked">Blocked</option>
            <option value="all">All</option>
          </select>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 6, flex: 1 }}>
            <input
              className="admin-users-search"
              placeholder={isGuests ? 'Search by username…' : 'Search by username or email…'}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">Search</button>
            {search && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setSearchInput(''); }}>Clear</button>}
          </form>
        </div>

        {err && <p className="form-error">{err}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                {!isGuests && <th>Email</th>}
                <th>Gender</th>
                <th>Age</th>
                <th>Location</th>
                {isGuests && <th>IP Address</th>}
                <th>Joined</th>
                <th>Last Seen</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr className="admin-empty-row"><td colSpan={10}>Loading…</td></tr>}
              {!loading && data?.users.length === 0 && (
                <tr className="admin-empty-row"><td colSpan={10}>No users found</td></tr>
              )}
              {!loading && data?.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {u.isAdmin && <span title="Admin" style={{ marginRight: 4 }}>👑</span>}
                      {u.telegramId && <span title={`Telegram: @${u.telegramUsername || u.telegramId}`} style={{ marginRight: 4 }}>✈️</span>}
                      {u.username}
                    </div>
                    <div className="admin-users-meta">#{u.id}</div>
                    {u.telegramUsername && <div className="admin-users-meta">@{u.telegramUsername}</div>}
                    {u.violationCount > 0 && (
                      <div className="admin-violation-badge" title="Violation count">⚠ {u.violationCount}</div>
                    )}
                  </td>
                  {!isGuests && <td style={{ color: 'var(--text2)', fontSize: '0.82rem' }}>{u.email || '—'}</td>}
                  <td>{u.gender}</td>
                  <td>{u.age}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>{u.state}, {u.country}</td>
                  {isGuests && <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text2)' }}>{u.ipAddress || '—'}</td>}
                  <td style={{ fontSize: '0.8rem', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDate(u.createdAt)}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDate(u.lastSeen)}</td>
                  <td>
                    {u.isAdmin
                      ? <span className="admin-pill admin">Admin</span>
                      : u.isBlocked
                        ? <span className="admin-pill blocked">Blocked</span>
                        : u.isGuest
                          ? <span className="admin-pill guest">Guest</span>
                          : <span className="admin-pill registered">Member</span>}
                  </td>
                  <td>
                    {!u.isAdmin && (
                      <div className="admin-action-btns">
                        <button
                          className={`btn btn-sm ${u.isBlocked ? 'btn-success' : 'btn-danger'}`}
                          disabled={actionLoading === u.id}
                          onClick={() => blockUser(u.id, !u.isBlocked)}
                          title={u.isBlocked ? 'Unblock' : 'Block'}
                        >
                          {actionLoading === u.id ? '…' : u.isBlocked ? '✓ Unblock' : '🚫 Block'}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={actionLoading === u.id}
                          onClick={() => deleteUser(u.id, u.username)}
                          title="Delete user"
                          style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--danger)' }}
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.pages > 1 && (
          <div className="admin-users-pagination">
            <span className="admin-users-page-info">Page {page} of {data.pages} · {data.total} users</span>
            <div className="admin-users-page-btns">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Moderation tab ─────────────────────────────────────────────
function ModerationTab({ token, threshold, onThresholdSaved }) {
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [wordErr, setWordErr] = useState('');
  const [wordMsg, setWordMsg] = useState('');
  const [thresholdInput, setThresholdInput] = useState(String(threshold));
  const [thresholdMsg, setThresholdMsg] = useState('');
  const [violations, setViolations] = useState(null);
  const [vPage, setVPage] = useState(1);

  const fetchWords = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/words', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setWords(await res.json());
    } catch { /* ignore */ }
  }, [token]);

  const fetchViolations = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/violations?page=${vPage}&limit=30`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setViolations(await res.json());
    } catch { /* ignore */ }
  }, [token, vPage]);

  useEffect(() => { fetchWords(); fetchViolations(); }, [fetchWords, fetchViolations]);
  useEffect(() => { setThresholdInput(String(threshold)); }, [threshold]);

  const addWord = async (e) => {
    e.preventDefault();
    setWordErr(''); setWordMsg('');
    const w = newWord.trim().toLowerCase();
    if (!w) return;
    try {
      const res = await fetch('/api/admin/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ word: w }),
      });
      const data = await res.json();
      if (!res.ok) { setWordErr(data.error); return; }
      setNewWord('');
      setWordMsg('Word added ✓');
      setTimeout(() => setWordMsg(''), 2000);
      fetchWords();
    } catch { setWordErr('Failed to add'); }
  };

  const removeWord = async (id) => {
    await fetch(`/api/admin/words/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchWords();
  };

  const saveThreshold = async (e) => {
    e.preventDefault();
    const val = parseInt(thresholdInput);
    if (!val || val < 1) return;
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ auto_block_threshold: String(val) }),
      });
      setThresholdMsg('Saved ✓');
      onThresholdSaved(val);
      setTimeout(() => setThresholdMsg(''), 2000);
    } catch { setThresholdMsg('Failed'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Auto-block threshold */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-section-icon">⚙️</span>
          <span className="admin-section-title">Auto-Block Settings</span>
        </div>
        <form className="admin-section-body" onSubmit={saveThreshold}>
          <div className="admin-field">
            <label>Auto-block after N violations</label>
            <div className="admin-threshold-row">
              <input
                type="number" min={1} max={20}
                className="admin-threshold-input"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm">Save</button>
              {thresholdMsg && <span className="admin-save-msg">{thresholdMsg}</span>}
            </div>
            <span className="admin-field-hint">A user's account is automatically blocked after sending this many messages containing banned words.</span>
          </div>
        </form>
      </div>

      {/* Word list */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-section-icon">🚫</span>
          <span className="admin-section-title">Blocked Word List</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text2)' }}>{words.length} words</span>
        </div>
        <div className="admin-section-body">
          <form onSubmit={addWord}>
            <div className="admin-word-row">
              <input
                className="admin-word-input"
                placeholder="Add word or phrase…"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                maxLength={100}
              />
              <button type="submit" className="btn btn-primary btn-sm">Add</button>
              {wordMsg && <span className="admin-save-msg">{wordMsg}</span>}
              {wordErr && <span className="admin-save-err">{wordErr}</span>}
            </div>
          </form>
          <div className="admin-word-chips">
            {words.map((w) => (
              <span key={w.id} className="admin-word-chip">
                {w.word}
                <button className="admin-word-chip-del" onClick={() => removeWord(w.id)} title="Remove">✕</button>
              </span>
            ))}
            {words.length === 0 && <span style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>No blocked words yet</span>}
          </div>
        </div>
      </div>

      {/* Violations log */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-section-icon">📋</span>
          <span className="admin-section-title">Violations Log</span>
          {violations && <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text2)' }}>{violations.total} total</span>}
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Matched Word</th>
                <th>Message</th>
                <th>Auto-Blocked?</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {!violations && <tr className="admin-empty-row"><td colSpan={5}>Loading…</td></tr>}
              {violations?.violations.length === 0 && <tr className="admin-empty-row"><td colSpan={5}>No violations recorded</td></tr>}
              {violations?.violations.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.username} <span className="admin-users-meta">#{v.userId}</span></td>
                  <td><span className="admin-word-chip" style={{ fontSize: '0.78rem' }}>{v.matchedWord}</span></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text2)', maxWidth: 260, wordBreak: 'break-word' }}>{v.message}</td>
                  <td>{v.autoBlocked ? <span className="admin-pill blocked">Yes</span> : <span style={{ color: 'var(--text3)' }}>No</span>}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDate(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {violations && violations.pages > 1 && (
          <div className="admin-users-pagination" style={{ padding: '12px 16px' }}>
            <span className="admin-users-page-info">Page {vPage} of {violations.pages}</span>
            <div className="admin-users-page-btns">
              <button className="btn btn-ghost btn-sm" disabled={vPage <= 1} onClick={() => setVPage((p) => p - 1)}>← Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={vPage >= violations.pages} onClick={() => setVPage((p) => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Integrations tab (Telegram) ────────────────────────────────
function IntegrationsTab({ token, settings, updateSettings }) {
  const [form, setForm] = useState({
    telegram_bot_username: settings.telegram_bot_username || '',
    telegram_bot_token: '',       // loaded separately
    telegram_channel_link: settings.telegram_channel_link || '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [tokenLoaded, setTokenLoaded] = useState(false);

  // Load private settings (bot token) when tab opens
  useEffect(() => {
    if (tokenLoaded) return;
    fetch('/api/admin/private-settings', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setForm((p) => ({ ...p, telegram_bot_token: d.telegram_bot_token || '' }));
        setTokenLoaded(true);
      })
      .catch(() => setErr('Could not load private settings'));
  }, [token, tokenLoaded]);

  useEffect(() => {
    setForm((p) => ({
      ...p,
      telegram_bot_username: settings.telegram_bot_username || '',
      telegram_channel_link: settings.telegram_channel_link || '',
    }));
  }, [settings.telegram_bot_username, settings.telegram_channel_link]);

  const save = async (e) => {
    e.preventDefault();
    setMsg(''); setErr('');
    try {
      await updateSettings(form, token);
      setMsg('Telegram settings saved ✓');
      setTimeout(() => setMsg(''), 3000);
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-section-icon">✈️</span>
          <span className="admin-section-title">Telegram Login Integration</span>
        </div>
        <form className="admin-section-body" onSubmit={save}>
          <div className="tg-setup-steps">
            <p className="tg-setup-title">📋 Setup Instructions</p>
            <ol className="tg-setup-list">
              <li>Open <strong>@BotFather</strong> on Telegram and send <code>/newbot</code> to create a bot.</li>
              <li>After creation, send <code>/setdomain</code> to BotFather → select your bot → enter your site domain (e.g. <code>yourdomain.com</code> — no https://).</li>
              <li>Copy the bot username (shown as <em>@YourBotName</em>) and paste below <strong>without the @</strong>.</li>
              <li>Copy the Bot Token (long string like <code>123456:ABC…</code>) and paste below.</li>
              <li>Optionally, add your Telegram Channel link so visitors can find your community.</li>
            </ol>
          </div>

          <div className="admin-fields-row">
            <div className="admin-field">
              <label>Bot Username <span className="admin-field-hint" style={{ display:'inline' }}>(without @)</span></label>
              <input
                value={form.telegram_bot_username}
                onChange={(e) => setForm((p) => ({ ...p, telegram_bot_username: e.target.value.replace('@', '') }))}
                placeholder="YourBotName"
                maxLength={64}
              />
              <span className="admin-field-hint">Used to render the Login widget on the landing page. Leave blank to hide the button.</span>
            </div>
            <div className="admin-field">
              <label>Bot Token <span style={{ color: 'var(--danger)', fontSize: '0.72rem' }}>🔒 Private</span></label>
              <input
                type="password"
                value={form.telegram_bot_token}
                onChange={(e) => setForm((p) => ({ ...p, telegram_bot_token: e.target.value }))}
                placeholder={tokenLoaded ? (form.telegram_bot_token ? '••••••••' : 'Not set') : 'Loading…'}
                maxLength={200}
                autoComplete="off"
              />
              <span className="admin-field-hint">Never shared publicly. Used server-side to verify login authenticity.</span>
            </div>
          </div>

          <div className="admin-field">
            <label>Telegram Channel / Group Link</label>
            <input
              value={form.telegram_channel_link}
              onChange={(e) => setForm((p) => ({ ...p, telegram_channel_link: e.target.value }))}
              placeholder="https://t.me/yourchannel"
              maxLength={200}
            />
            <span className="admin-field-hint">Optional — shows a "Join our Telegram" banner on the landing page.</span>
          </div>

          <div className="admin-save-row">
            <button type="submit" className="btn btn-primary">Save Telegram Settings</button>
            {msg && <span className="admin-save-msg">{msg}</span>}
            {err && <span className="admin-save-err">{err}</span>}
          </div>
        </form>
      </div>

      {/* Status indicator */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-section-icon">🔌</span>
          <span className="admin-section-title">Integration Status</span>
        </div>
        <div className="admin-section-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.1rem' }}>
                {settings.telegram_bot_username ? '✅' : '⭕'}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Telegram Login Widget</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>
                  {settings.telegram_bot_username
                    ? `Active — bot: @${settings.telegram_bot_username}`
                    : 'Not configured — set Bot Username and Token to enable'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.1rem' }}>
                {settings.telegram_channel_link ? '✅' : '⭕'}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Channel Banner</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>
                  {settings.telegram_channel_link
                    ? `Shown — ${settings.telegram_channel_link}`
                    : 'Not configured — add a channel link to show banner'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scripts tab ────────────────────────────────────────────────
function ScriptsTab({ token, settings, updateSettings }) {
  const [form, setForm] = useState({
    ga_tracking_id: settings.ga_tracking_id || '',
    custom_head_code: settings.custom_head_code || '',
    custom_body_code: settings.custom_body_code || '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    setForm({
      ga_tracking_id: settings.ga_tracking_id || '',
      custom_head_code: settings.custom_head_code || '',
      custom_body_code: settings.custom_body_code || '',
    });
  }, [settings]);

  const save = async (e) => {
    e.preventDefault();
    setMsg(''); setErr('');
    try {
      await updateSettings(form, token);
      setMsg('Scripts saved ✓');
      setTimeout(() => setMsg(''), 3000);
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <span className="admin-section-icon">📡</span>
        <span className="admin-section-title">Analytics & Custom Scripts</span>
      </div>
      <form className="admin-section-body" onSubmit={save}>
        <div className="admin-field">
          <label>Google Analytics 4 — Measurement ID</label>
          <input
            value={form.ga_tracking_id}
            onChange={(e) => setForm((p) => ({ ...p, ga_tracking_id: e.target.value }))}
            placeholder="G-XXXXXXXXXX"
            maxLength={30}
          />
          <span className="admin-field-hint">
            Paste your GA4 Measurement ID (e.g. <code>G-ABC123XYZ</code>). Leave blank to disable. The gtag script is injected automatically.
          </span>
        </div>

        <div className="admin-field">
          <label>Custom &lt;head&gt; Code</label>
          <textarea
            className="admin-code-textarea"
            value={form.custom_head_code}
            onChange={(e) => setForm((p) => ({ ...p, custom_head_code: e.target.value }))}
            placeholder={'<!-- e.g. Meta Pixel, Hotjar, custom <meta> tags -->\n<script>\n  // your code here\n</script>'}
            rows={6}
          />
          <span className="admin-field-hint">Injected into <code>&lt;head&gt;</code>. Supports any HTML including <code>&lt;script&gt;</code> tags.</span>
        </div>

        <div className="admin-field">
          <label>Custom &lt;body&gt; Code</label>
          <textarea
            className="admin-code-textarea"
            value={form.custom_body_code}
            onChange={(e) => setForm((p) => ({ ...p, custom_body_code: e.target.value }))}
            placeholder={'<!-- e.g. live chat widget, Tawk.to, Intercom -->\n<script>\n  // your code here\n</script>'}
            rows={6}
          />
          <span className="admin-field-hint">Injected into <code>&lt;body&gt;</code> end. Good for chat widgets or tracking pixels.</span>
        </div>

        <div className="admin-save-row">
          <button type="submit" className="btn btn-primary">Save Scripts</button>
          {msg && <span className="admin-save-msg">{msg}</span>}
          {err && <span className="admin-save-err">{err}</span>}
        </div>
      </form>
    </div>
  );
}

// ── Bots control panel ─────────────────────────────────────────
function BotsControl({ socket }) {
  const [status, setStatus] = useState(null); // { active, count }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;
    socket.emit('admin-get-bots-status');
    socket.on('bots-status', setStatus);
    return () => socket.off('bots-status', setStatus);
  }, [socket]);

  const clearBots = () => {
    setLoading(true);
    socket.emit('admin-clear-bots');
    setTimeout(() => setLoading(false), 800);
  };
  const restoreBots = () => {
    setLoading(true);
    socket.emit('admin-restore-bots');
    setTimeout(() => setLoading(false), 800);
  };

  return (
    <div className="admin-section" style={{ marginTop: 20 }}>
      <div className="admin-section-header">
        <span className="admin-section-icon">🤖</span>
        <span className="admin-section-title">Bot Users</span>
        {status && (
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: status.active ? 'var(--success)' : 'var(--text3)' }}>
            {status.active ? `${status.count} active` : 'All removed'}
          </span>
        )}
      </div>
      <div className="admin-section-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          className="btn btn-danger btn-sm"
          disabled={loading || status?.count === 0}
          onClick={clearBots}
        >
          🗑 Remove All Bots
        </button>
        <button
          className="btn btn-success btn-sm"
          disabled={loading || (status?.active && status?.count === 100)}
          onClick={restoreBots}
        >
          ♻️ Restore Bots
        </button>
        <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
          Instantly adds or removes all 100 bot users for every connected session.
        </span>
      </div>
    </div>
  );
}

// ── Main Admin component ───────────────────────────────────────
export default function Admin() {
  const { user, token, logout } = useAuth();
  const { settings, updateSettings } = useSiteSettings();
  const { socket, onlineCount } = useSocket();
  const navigate = useNavigate();

  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [statsErr, setStatsErr] = useState('');

  const [brandForm, setBrandForm] = useState({ site_name: '', site_logo: '', site_tagline: '' });
  const [brandMsg, setBrandMsg] = useState(''); const [brandErr, setBrandErr] = useState('');

  const [seoForm, setSeoForm] = useState({ meta_title: '', meta_description: '', meta_keywords: '' });
  const [seoMsg, setSeoMsg] = useState(''); const [seoErr, setSeoErr] = useState('');

  const [autoBlockThreshold, setAutoBlockThreshold] = useState(
    parseInt(settings.auto_block_threshold) || 3
  );

  useEffect(() => { if (user && !user.isAdmin) navigate('/chat', { replace: true }); }, [user]);

  useEffect(() => {
    setBrandForm({ site_name: settings.site_name || '', site_logo: settings.site_logo || '', site_tagline: settings.site_tagline || '' });
    setSeoForm({ meta_title: settings.meta_title || '', meta_description: settings.meta_description || '', meta_keywords: settings.meta_keywords || '' });
    setAutoBlockThreshold(parseInt(settings.auto_block_threshold) || 3);
  }, [settings]);

  useEffect(() => {
    if (tab !== 'stats') return;
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then(setStats).catch(() => setStatsErr('Failed to load stats'));
  }, [tab, token]);

  const handleBrand = async (e) => {
    e.preventDefault(); setBrandMsg(''); setBrandErr('');
    try { await updateSettings(brandForm, token); setBrandMsg('Branding saved ✓'); setTimeout(() => setBrandMsg(''), 3000); }
    catch (ex) { setBrandErr(ex.message); }
  };
  const handleSeo = async (e) => {
    e.preventDefault(); setSeoMsg(''); setSeoErr('');
    try { await updateSettings(seoForm, token); setSeoMsg('SEO settings saved ✓'); setTimeout(() => setSeoMsg(''), 3000); }
    catch (ex) { setSeoErr(ex.message); }
  };
  if (!user?.isAdmin) return null;

  const TABS = [
    { key: 'stats',        label: '📊 Stats' },
    { key: 'users',        label: '👥 Users' },
    { key: 'moderation',   label: '🛡️ Moderation' },
    { key: 'integrations', label: '✈️ Telegram' },
    { key: 'scripts',      label: '📡 Scripts' },
    { key: 'branding',     label: '🎨 Branding' },
    { key: 'seo',          label: '🔍 SEO' },
  ];

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-brand">
          <span style={{ fontSize: '1.5rem' }}>{settings.site_logo}</span>
          <span className="admin-brand-title">{settings.site_name}</span>
          <span className="admin-badge">Admin</span>
        </div>
        <div className="admin-header-right">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/chat')}>← Chat</button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <nav className="admin-tabs">
        {TABS.map(({ key, label }) => (
          <button key={key} className={`admin-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

      <div className="admin-body">

        {/* Stats */}
        {tab === 'stats' && (
          <>
            <div className="admin-stats">
              {[
                { icon: '🟢', value: onlineCount,               label: 'Online Now' },
                { icon: '👤', value: stats?.totalUsers,         label: 'Total Users' },
                { icon: '📝', value: stats?.registeredUsers,    label: 'Registered' },
                { icon: '👻', value: stats?.guestUsers,         label: 'Guests' },
                { icon: '💬', value: stats?.totalMessages,      label: 'Messages Sent' },
                { icon: '🚫', value: stats?.blockedUsers,       label: 'Blocked' },
              ].map(({ icon, value, label }) => (
                <div key={label} className="admin-stat-card">
                  <div className="admin-stat-icon">{icon}</div>
                  <div className="admin-stat-value">{value ?? '…'}</div>
                  <div className="admin-stat-label">{label}</div>
                </div>
              ))}
            </div>
            {statsErr && <p className="form-error">{statsErr}</p>}
            <BotsControl socket={socket} />
          </>
        )}

        {/* Users */}
        {tab === 'users' && <UsersTab token={token} />}

        {/* Moderation */}
        {tab === 'moderation' && (
          <ModerationTab token={token} threshold={autoBlockThreshold} onThresholdSaved={setAutoBlockThreshold} />
        )}

        {/* Integrations */}
        {tab === 'integrations' && <IntegrationsTab token={token} settings={settings} updateSettings={updateSettings} />}

        {/* Scripts */}
        {tab === 'scripts' && <ScriptsTab token={token} settings={settings} updateSettings={updateSettings} />}

        {/* Branding */}
        {tab === 'branding' && (
          <div className="admin-section">
            <div className="admin-section-header"><span className="admin-section-icon">🎨</span><span className="admin-section-title">Branding & Identity</span></div>
            <form className="admin-section-body" onSubmit={handleBrand}>
              <div className="admin-fields-row">
                <div className="admin-field">
                  <label>Site Name</label>
                  <input value={brandForm.site_name} onChange={(e) => setBrandForm((p) => ({ ...p, site_name: e.target.value }))} placeholder="RaunchyChat" maxLength={60} />
                </div>
                <div className="admin-field">
                  <label>Logo Emoji</label>
                  <input value={brandForm.site_logo} onChange={(e) => setBrandForm((p) => ({ ...p, site_logo: e.target.value }))} placeholder="🔥" maxLength={10} />
                  <span className="admin-field-hint">Paste any emoji or symbol</span>
                </div>
              </div>
              <div className="admin-field">
                <label>Tagline</label>
                <input value={brandForm.site_tagline} onChange={(e) => setBrandForm((p) => ({ ...p, site_tagline: e.target.value }))} placeholder="Meet. Flirt. Connect." maxLength={120} />
              </div>
              <div className="admin-save-row">
                <button type="submit" className="btn btn-primary">Save Branding</button>
                {brandMsg && <span className="admin-save-msg">{brandMsg}</span>}
                {brandErr && <span className="admin-save-err">{brandErr}</span>}
              </div>
            </form>
          </div>
        )}

        {/* SEO */}
        {tab === 'seo' && (
          <div className="admin-section">
            <div className="admin-section-header"><span className="admin-section-icon">🔍</span><span className="admin-section-title">SEO & Meta Tags</span></div>
            <form className="admin-section-body" onSubmit={handleSeo}>
              <div className="admin-field">
                <label>Page Title</label>
                <input value={seoForm.meta_title} onChange={(e) => setSeoForm((p) => ({ ...p, meta_title: e.target.value }))} placeholder="RaunchyChat — Meet & Chat Online" maxLength={120} />
                <span className="admin-field-hint">Recommended: 50–60 characters</span>
              </div>
              <div className="admin-field">
                <label>Meta Description</label>
                <textarea value={seoForm.meta_description} onChange={(e) => setSeoForm((p) => ({ ...p, meta_description: e.target.value }))} placeholder="Free adult chat rooms." maxLength={300} />
                <span className="admin-field-hint">Recommended: 150–160 characters</span>
              </div>
              <div className="admin-field">
                <label>Keywords (comma-separated)</label>
                <input value={seoForm.meta_keywords} onChange={(e) => setSeoForm((p) => ({ ...p, meta_keywords: e.target.value }))} placeholder="adult chat, free chat" maxLength={300} />
              </div>
              <div className="admin-save-row">
                <button type="submit" className="btn btn-primary">Save SEO</button>
                {seoMsg && <span className="admin-save-msg">{seoMsg}</span>}
                {seoErr && <span className="admin-save-err">{seoErr}</span>}
              </div>
            </form>
          </div>
        )}

        {/* Theme tab removed */}
        {tab === 'theme' && (
          <div className="admin-section">
            <div className="admin-section-header"><span className="admin-section-icon">✨</span><span className="admin-section-title">Theme</span></div>
            <div className="admin-section-body">
              <p style={{ color: 'var(--text2)' }}>The site uses a fixed chatib.us-style theme.</p>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
