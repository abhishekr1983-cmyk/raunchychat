const express = require('express');
const router = express.Router();
const { client } = require('../db');
const { requireAdmin } = require('../middleware/adminAuth');

// Public: get all site settings (needed by client to render branding/SEO)
router.get('/settings', async (req, res) => {
  try {
    const result = await client.execute('SELECT key, value FROM site_settings');
    const settings = {};
    for (const row of result.rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// Admin: update site settings
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const allowed = [
      'site_name', 'site_logo', 'site_tagline',
      'meta_title', 'meta_description', 'meta_keywords',
      'default_theme',
    ];
    for (const [key, value] of Object.entries(req.body)) {
      if (!allowed.includes(key)) continue;
      await client.execute({
        sql: `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        args: [key, String(value).slice(0, 500)],
      });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin] update settings error:', e);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Admin: list users (registered or guests)
// GET /api/admin/users?type=registered|guest|all&search=&page=1&limit=50
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const type = req.query.type || 'all';   // 'registered' | 'guest' | 'all'
    const search = (req.query.search || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    let whereClause = '';
    const args = [];

    if (type === 'registered') { whereClause += ' AND is_guest = 0'; }
    else if (type === 'guest')  { whereClause += ' AND is_guest = 1'; }

    if (search) {
      whereClause += ' AND (username LIKE ? OR email LIKE ?)';
      args.push(`%${search}%`, `%${search}%`);
    }

    const countResult = await client.execute({
      sql: `SELECT COUNT(*) AS n FROM users WHERE 1=1${whereClause}`,
      args,
    });
    const total = Number(countResult.rows[0].n);

    const rows = (await client.execute({
      sql: `SELECT id, username, email, gender, age, state, country,
                   is_guest, is_admin, ip_address, created_at, last_seen
            FROM users
            WHERE 1=1${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    })).rows;

    const users = rows.map((r) => ({
      id: Number(r.id),
      username: r.username,
      email: r.email || null,
      gender: r.gender,
      age: Number(r.age),
      state: r.state,
      country: r.country,
      isGuest: r.is_guest === 1,
      isAdmin: r.is_admin === 1,
      ipAddress: r.ip_address || null,
      createdAt: r.created_at,
      lastSeen: r.last_seen || null,
    }));

    res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) {
    console.error('[admin] users error:', e);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Admin: stats dashboard
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [users, messages, guests, registered] = await Promise.all([
      client.execute('SELECT COUNT(*) AS n FROM users'),
      client.execute('SELECT COUNT(*) AS n FROM private_messages'),
      client.execute('SELECT COUNT(*) AS n FROM users WHERE is_guest = 1'),
      client.execute('SELECT COUNT(*) AS n FROM users WHERE is_guest = 0'),
    ]);
    res.json({
      totalUsers: Number(users.rows[0].n),
      totalMessages: Number(messages.rows[0].n),
      guestUsers: Number(guests.rows[0].n),
      registeredUsers: Number(registered.rows[0].n),
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
