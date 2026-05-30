const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { client } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function safeUser(row, extra = {}) {
  return {
    id: Number(row.id),
    username: row.username,
    email: row.email || null,
    gender: row.gender,
    age: Number(row.age),
    state: row.state,
    country: row.country,
    isGuest: row.is_guest === 1,
    isAdmin: row.is_admin === 1,
    ...extra,
  };
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, gender, age, state, country } = req.body;

    if (!username || !email || !password || !gender || !age || !state || !country)
      return res.status(400).json({ error: 'All fields are required' });
    if (username.length < 3 || username.length > 24)
      return res.status(400).json({ error: 'Username must be 3–24 characters' });
    if (Number(age) < 18 || Number(age) > 120)
      return res.status(400).json({ error: 'Age must be 18 or older' });

    const existing = (await client.execute({
      sql: 'SELECT id FROM users WHERE username = ? OR email = ?',
      args: [username, email],
    })).rows[0];
    if (existing) return res.status(409).json({ error: 'Username or email already taken' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await client.execute({
      sql: 'INSERT INTO users (username, email, password_hash, gender, age, state, country, is_guest) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
      args: [username, email, passwordHash, gender, Number(age), state, country],
    });

    const userId = Number(result.lastInsertRowid);
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userId, username, email, gender, age: Number(age), state, country, isGuest: false, isAdmin: false } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const row = (await client.execute({
      sql: 'SELECT * FROM users WHERE email = ? AND is_guest = 0',
      args: [email],
    })).rows[0];

    if (!row || !(await bcrypt.compare(password, row.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: Number(row.id) }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: safeUser(row) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/guest', async (req, res) => {
  try {
    const { username, gender, age, state, country } = req.body;

    if (!username || !gender || !age || !state || !country)
      return res.status(400).json({ error: 'All fields are required' });
    if (username.length < 3 || username.length > 24)
      return res.status(400).json({ error: 'Username must be 3–24 characters' });
    if (Number(age) < 18 || Number(age) > 120)
      return res.status(400).json({ error: 'Age must be 18 or older' });

    const existing = (await client.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [username],
    })).rows[0];
    if (existing) return res.status(409).json({ error: 'Username already taken, please choose another' });

    const result = await client.execute({
      sql: 'INSERT INTO users (username, gender, age, state, country, is_guest) VALUES (?, ?, ?, ?, ?, 1)',
      args: [username, gender, Number(age), state, country],
    });

    const userId = Number(result.lastInsertRowid);
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: userId, username, gender, age: Number(age), state, country, isGuest: true, isAdmin: false } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
