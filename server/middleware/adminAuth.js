const jwt = require('jsonwebtoken');
const { client } = require('../db');
const { JWT_SECRET } = require('./auth');

async function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  const token = auth.slice(7);
  try {
    const { userId } = jwt.verify(token, JWT_SECRET);
    const row = (await client.execute({
      sql: 'SELECT id, username, is_admin FROM users WHERE id = ?',
      args: [userId],
    })).rows[0];
    if (!row) return res.status(401).json({ error: 'User not found' });
    if (!row.is_admin) return res.status(403).json({ error: 'Admin access required' });
    req.adminUser = { id: Number(row.id), username: row.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { requireAdmin };
