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
