const express = require('express');
const router = express.Router();
const { client } = require('../db');
const { requireAdmin } = require('../middleware/adminAuth');
const { kickUser, refreshBlockedWords } = require('../socket/handlers');

// ── Public: get all site settings ─────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const result = await client.execute('SELECT key, value FROM site_settings');
    const settings = {};
    for (const row of result.rows) settings[row.key] = row.value;
    res.json(settings);
  } catch {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// ── Admin: update site settings ────────────────────────────────
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const allowed = [
      'site_name', 'site_logo', 'site_tagline',
      'meta_title', 'meta_description', 'meta_keywords',
      'default_theme',
      'ga_tracking_id', 'custom_head_code', 'custom_body_code',
      'auto_block_threshold',
    ];
    for (const [key, value] of Object.entries(req.body)) {
      if (!allowed.includes(key)) continue;
      await client.execute({
        sql: `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        args: [key, String(value).slice(0, 5000)],
      });
    }
    // If threshold changed, refresh cache
    if ('auto_block_threshold' in req.body) await refreshBlockedWords();
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin] update settings:', e);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ── Admin: stats ───────────────────────────────────────────────
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [users, messages, guests, registered, blocked] = await Promise.all([
      client.execute('SELECT COUNT(*) AS n FROM users'),
      client.execute('SELECT COUNT(*) AS n FROM private_messages'),
      client.execute('SELECT COUNT(*) AS n FROM users WHERE is_guest = 1'),
      client.execute('SELECT COUNT(*) AS n FROM users WHERE is_guest = 0'),
      client.execute('SELECT COUNT(*) AS n FROM users WHERE is_blocked = 1'),
    ]);
    res.json({
      totalUsers: Number(users.rows[0].n),
      totalMessages: Number(messages.rows[0].n),
      guestUsers: Number(guests.rows[0].n),
      registeredUsers: Number(registered.rows[0].n),
      blockedUsers: Number(blocked.rows[0].n),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ── Admin: list users ──────────────────────────────────────────
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const type = req.query.type || 'all';
    const search = (req.query.search || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    let whereClause = '';
    const args = [];

    if (type === 'registered') { whereClause += ' AND is_guest = 0'; }
    else if (type === 'guest')  { whereClause += ' AND is_guest = 1'; }
    else if (type === 'blocked'){ whereClause += ' AND is_blocked = 1'; }

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
                   is_guest, is_admin, is_blocked, violation_count,
                   ip_address, created_at, last_seen
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
      isBlocked: r.is_blocked === 1,
      violationCount: Number(r.violation_count || 0),
      ipAddress: r.ip_address || null,
      createdAt: r.created_at,
      lastSeen: r.last_seen || null,
    }));

    res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) {
    console.error('[admin] users:', e);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// ── Admin: block user ──────────────────────────────────────────
router.post('/users/:id/block', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.adminUser.id) return res.status(400).json({ error: "Can't block yourself" });
    await client.execute({ sql: 'UPDATE users SET is_blocked = 1 WHERE id = ?', args: [id] });
    kickUser(id, 'Your account has been blocked by an administrator.');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// ── Admin: unblock user ────────────────────────────────────────
router.post('/users/:id/unblock', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await client.execute({
      sql: 'UPDATE users SET is_blocked = 0, violation_count = 0 WHERE id = ?',
      args: [id],
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// ── Admin: delete user ─────────────────────────────────────────
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.adminUser.id) return res.status(400).json({ error: "Can't delete yourself" });
    kickUser(id, 'Your account has been deleted by an administrator.');
    await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── Admin: list blocked words ──────────────────────────────────
router.get('/words', requireAdmin, async (req, res) => {
  try {
    const rows = (await client.execute(
      'SELECT id, word, created_at FROM blocked_words ORDER BY created_at DESC'
    )).rows;
    res.json(rows.map((r) => ({ id: Number(r.id), word: r.word, createdAt: r.created_at })));
  } catch {
    res.status(500).json({ error: 'Failed to load words' });
  }
});

// ── Admin: add blocked word ────────────────────────────────────
router.post('/words', requireAdmin, async (req, res) => {
  try {
    const word = (req.body.word || '').trim().toLowerCase();
    if (!word || word.length > 100) return res.status(400).json({ error: 'Invalid word' });
    await client.execute({ sql: 'INSERT INTO blocked_words (word) VALUES (?)', args: [word] });
    await refreshBlockedWords();
    res.json({ ok: true });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Word already in list' });
    res.status(500).json({ error: 'Failed to add word' });
  }
});

// ── Admin: delete blocked word ─────────────────────────────────
router.delete('/words/:id', requireAdmin, async (req, res) => {
  try {
    await client.execute({ sql: 'DELETE FROM blocked_words WHERE id = ?', args: [Number(req.params.id)] });
    await refreshBlockedWords();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove word' });
  }
});

// ── Admin: violations log ──────────────────────────────────────
router.get('/violations', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const total = Number((await client.execute('SELECT COUNT(*) AS n FROM violations')).rows[0].n);
    const rows = (await client.execute({
      sql: 'SELECT * FROM violations ORDER BY created_at DESC LIMIT ? OFFSET ?',
      args: [limit, offset],
    })).rows;

    res.json({
      violations: rows.map((r) => ({
        id: Number(r.id),
        userId: Number(r.user_id),
        username: r.username,
        matchedWord: r.matched_word,
        message: r.message,
        autoBlocked: r.auto_blocked === 1,
        createdAt: r.created_at,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load violations' });
  }
});

module.exports = router;
