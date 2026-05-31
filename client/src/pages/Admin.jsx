import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { useSocket } from '../contexts/SocketContext';
import { THEMES } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import ThemeSelector from '../components/ThemeSelector';

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
  const [data, setData] = useState(null); // { users, total, pages }
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const params = new URLSearchParams({ type: userType, page, limit: 50 });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json());
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [userType, search, page, token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Reset page when type/search changes
  useEffect(() => { setPage(1); }, [userType, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const isGuests = userType === 'guest';

  return (
    <div className="admin-section" style={{ overflow: 'hidden' }}>
      <div className="admin-section-header">
        <span className="admin-section-icon">{isGuests ? '👻' : '👤'}</span>
        <span className="admin-section-title">
          {isGuests ? 'Guest Users' : userType === 'all' ? 'All Users' : 'Registered Users'}
        </span>
        {data && (
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text2)' }}>
            {data.total} total
          </span>
        )}
      </div>

      <div className="admin-section-body">
        {/* Toolbar */}
        <div className="admin-users-toolbar">
          <select
            className="admin-users-type"
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
          >
            <option value="registered">Registered</option>
            <option value="guest">Guests</option>
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
            {search && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setSearchInput(''); }}>
                Clear
              </button>
            )}
          </form>
        </div>

        {err && <p className="form-error">{err}</p>}

        {/* Table */}
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
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="admin-empty-row">
                  <td colSpan={isGuests ? 8 : 8}>Loading…</td>
                </tr>
              )}
              {!loading && data?.users.length === 0 && (
                <tr className="admin-empty-row">
                  <td colSpan={isGuests ? 8 : 8}>No users found</td>
                </tr>
              )}
              {!loading && data?.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {u.isAdmin && <span title="Admin" style={{ marginRight: 4 }}>👑</span>}
                      {u.username}
                    </div>
                    <div className="admin-users-meta">#{u.id}</div>
                  </td>
                  {!isGuests && (
                    <td style={{ color: 'var(--text2)', fontSize: '0.82rem' }}>
                      {u.email || '—'}
                    </td>
                  )}
                  <td>{u.gender}</td>
                  <td>{u.age}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>
                    {u.state}, {u.country}
                  </td>
                  {isGuests && (
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text2)' }}>
                      {u.ipAddress || '—'}
                    </td>
                  )}
                  <td style={{ fontSize: '0.8rem', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                    {formatDate(u.createdAt)}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                    {formatDate(u.lastSeen)}
                  </td>
                  <td>
                    {u.isAdmin
                      ? <span className="admin-pill admin">Admin</span>
                      : u.isGuest
                        ? <span className="admin-pill guest">Guest</span>
                        : <span className="admin-pill registered">Member</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="admin-users-pagination">
            <span className="admin-users-page-info">
              Page {page} of {data.pages} · {data.total} users
            </span>
            <div className="admin-users-page-btns">
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >← Prev</button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Admin component ───────────────────────────────────────
export default function Admin() {
  const { user, token, logout } = useAuth();
  const { settings, updateSettings } = useSiteSettings();
  const { onlineCount } = useSocket();
  const navigate = useNavigate();

  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [statsErr, setStatsErr] = useState('');

  // Branding form
  const [brandForm, setBrandForm] = useState({ site_name: '', site_logo: '', site_tagline: '' });
  const [brandMsg, setBrandMsg] = useState('');
  const [brandErr, setBrandErr] = useState('');

  // SEO form
  const [seoForm, setSeoForm] = useState({ meta_title: '', meta_description: '', meta_keywords: '' });
  const [seoMsg, setSeoMsg] = useState('');
  const [seoErr, setSeoErr] = useState('');

  // Theme default
  const [themeForm, setThemeForm] = useState({ default_theme: '' });
  const [themeMsg, setThemeMsg] = useState('');

  // Redirect if not admin
  useEffect(() => {
    if (user && !user.isAdmin) navigate('/chat', { replace: true });
  }, [user]);

  // Populate forms from settings once loaded
  useEffect(() => {
    setBrandForm({
      site_name: settings.site_name || '',
      site_logo: settings.site_logo || '',
      site_tagline: settings.site_tagline || '',
    });
    setSeoForm({
      meta_title: settings.meta_title || '',
      meta_description: settings.meta_description || '',
      meta_keywords: settings.meta_keywords || '',
    });
    setThemeForm({ default_theme: settings.default_theme || 'dark-seduction' });
  }, [settings]);

  // Fetch stats when tab = stats
  useEffect(() => {
    if (tab !== 'stats') return;
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStatsErr('Failed to load stats'));
  }, [tab, token]);

  const handleBrand = async (e) => {
    e.preventDefault();
    setBrandMsg(''); setBrandErr('');
    try {
      await updateSettings(brandForm, token);
      setBrandMsg('Branding saved ✓');
      setTimeout(() => setBrandMsg(''), 3000);
    } catch (err) { setBrandErr(err.message); }
  };

  const handleSeo = async (e) => {
    e.preventDefault();
    setSeoMsg(''); setSeoErr('');
    try {
      await updateSettings(seoForm, token);
      setSeoMsg('SEO settings saved ✓');
      setTimeout(() => setSeoMsg(''), 3000);
    } catch (err) { setSeoErr(err.message); }
  };

  const handleTheme = async (e) => {
    e.preventDefault();
    setThemeMsg('');
    try {
      await updateSettings(themeForm, token);
      setThemeMsg('Default theme saved ✓');
      setTimeout(() => setThemeMsg(''), 3000);
    } catch { setThemeMsg('Failed to save'); }
  };

  if (!user?.isAdmin) return null;

  const TABS = [
    { key: 'stats',    label: '📊 Stats' },
    { key: 'users',    label: '👥 Users' },
    { key: 'branding', label: '🎨 Branding' },
    { key: 'seo',      label: '🔍 SEO' },
    { key: 'theme',    label: '✨ Theme' },
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
          <ThemeSelector />
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/chat')}>← Chat</button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <nav className="admin-tabs">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`admin-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="admin-body">

        {/* ── Stats ── */}
        {tab === 'stats' && (
          <>
            <div className="admin-stats">
              <div className="admin-stat-card">
                <div className="admin-stat-icon">🟢</div>
                <div className="admin-stat-value">{onlineCount}</div>
                <div className="admin-stat-label">Online Now</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon">👤</div>
                <div className="admin-stat-value">{stats ? stats.totalUsers : '…'}</div>
                <div className="admin-stat-label">Total Users</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon">📝</div>
                <div className="admin-stat-value">{stats ? stats.registeredUsers : '…'}</div>
                <div className="admin-stat-label">Registered</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon">👻</div>
                <div className="admin-stat-value">{stats ? stats.guestUsers : '…'}</div>
                <div className="admin-stat-label">Guests</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon">💬</div>
                <div className="admin-stat-value">{stats ? stats.totalMessages : '…'}</div>
                <div className="admin-stat-label">Messages Sent</div>
              </div>
            </div>
            {statsErr && <p className="form-error">{statsErr}</p>}
          </>
        )}

        {/* ── Users ── */}
        {tab === 'users' && <UsersTab token={token} />}

        {/* ── Branding ── */}
        {tab === 'branding' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <span className="admin-section-icon">🎨</span>
              <span className="admin-section-title">Branding & Identity</span>
            </div>
            <form className="admin-section-body" onSubmit={handleBrand}>
              <div className="admin-fields-row">
                <div className="admin-field">
                  <label>Site Name</label>
                  <input
                    value={brandForm.site_name}
                    onChange={(e) => setBrandForm((p) => ({ ...p, site_name: e.target.value }))}
                    placeholder="RaunchyChat"
                    maxLength={60}
                  />
                </div>
                <div className="admin-field">
                  <label>Logo Emoji</label>
                  <input
                    value={brandForm.site_logo}
                    onChange={(e) => setBrandForm((p) => ({ ...p, site_logo: e.target.value }))}
                    placeholder="🔥"
                    maxLength={10}
                  />
                  <span className="admin-field-hint">Paste any emoji or symbol</span>
                </div>
              </div>
              <div className="admin-field">
                <label>Tagline</label>
                <input
                  value={brandForm.site_tagline}
                  onChange={(e) => setBrandForm((p) => ({ ...p, site_tagline: e.target.value }))}
                  placeholder="Meet. Flirt. Connect."
                  maxLength={120}
                />
              </div>
              <div className="admin-save-row">
                <button type="submit" className="btn btn-primary">Save Branding</button>
                {brandMsg && <span className="admin-save-msg">{brandMsg}</span>}
                {brandErr && <span className="admin-save-err">{brandErr}</span>}
              </div>
            </form>
          </div>
        )}

        {/* ── SEO ── */}
        {tab === 'seo' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <span className="admin-section-icon">🔍</span>
              <span className="admin-section-title">SEO & Meta Tags</span>
            </div>
            <form className="admin-section-body" onSubmit={handleSeo}>
              <div className="admin-field">
                <label>Page Title (browser tab + Google)</label>
                <input
                  value={seoForm.meta_title}
                  onChange={(e) => setSeoForm((p) => ({ ...p, meta_title: e.target.value }))}
                  placeholder="RaunchyChat — Meet & Chat Online"
                  maxLength={120}
                />
                <span className="admin-field-hint">Recommended: 50–60 characters</span>
              </div>
              <div className="admin-field">
                <label>Meta Description</label>
                <textarea
                  value={seoForm.meta_description}
                  onChange={(e) => setSeoForm((p) => ({ ...p, meta_description: e.target.value }))}
                  placeholder="Free adult chat rooms. Meet new people anonymously."
                  maxLength={300}
                />
                <span className="admin-field-hint">Recommended: 150–160 characters</span>
              </div>
              <div className="admin-field">
                <label>Keywords (comma-separated)</label>
                <input
                  value={seoForm.meta_keywords}
                  onChange={(e) => setSeoForm((p) => ({ ...p, meta_keywords: e.target.value }))}
                  placeholder="adult chat, free chat, anonymous chat"
                  maxLength={300}
                />
              </div>
              <div className="admin-save-row">
                <button type="submit" className="btn btn-primary">Save SEO</button>
                {seoMsg && <span className="admin-save-msg">{seoMsg}</span>}
                {seoErr && <span className="admin-save-err">{seoErr}</span>}
              </div>
            </form>
          </div>
        )}

        {/* ── Theme ── */}
        {tab === 'theme' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <span className="admin-section-icon">✨</span>
              <span className="admin-section-title">Default Theme for New Users</span>
            </div>
            <form className="admin-section-body" onSubmit={handleTheme}>
              <div className="admin-field">
                <label>Default Theme</label>
                <select
                  value={themeForm.default_theme}
                  onChange={(e) => setThemeForm({ default_theme: e.target.value })}
                >
                  {Object.entries(THEMES).map(([key, { name, emoji }]) => (
                    <option key={key} value={key}>{emoji} {name}</option>
                  ))}
                </select>
                <span className="admin-field-hint">Applied to users who haven't chosen a theme yet</span>
              </div>
              <div className="admin-save-row">
                <button type="submit" className="btn btn-primary">Save Theme</button>
                {themeMsg && <span className="admin-save-msg">{themeMsg}</span>}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
