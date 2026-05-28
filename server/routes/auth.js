const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, gender, age, state, country } = req.body;

    if (!username || !email || !password || !gender || !age || !state || !country) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (username.length < 3 || username.length > 24) {
      return res.status(400).json({ error: 'Username must be 3–24 characters' });
    }
    if (Number(age) < 18 || Number(age) > 120) {
      return res.status(400).json({ error: 'Age must be 13 or older' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, gender, age, state, country, is_guest) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
    ).run(username, email, passwordHash, gender, Number(age), state, country);

    const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: result.lastInsertRowid, username, email, gender, age: Number(age), state, country, isGuest: false },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_guest = 0').get(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        gender: user.gender,
        age: user.age,
        state: user.state,
        country: user.country,
        isGuest: false,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/guest', (req, res) => {
  try {
    const { username, gender, age, state, country } = req.body;

    if (!username || !gender || !age || !state || !country) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (username.length < 3 || username.length > 24) {
      return res.status(400).json({ error: 'Username must be 3–24 characters' });
    }
    if (Number(age) < 18 || Number(age) > 120) {
      return res.status(400).json({ error: 'Age must be 13 or older' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken, please choose another' });
    }

    const result = db.prepare(
      'INSERT INTO users (username, gender, age, state, country, is_guest) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(username, gender, Number(age), state, country);

    const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: { id: result.lastInsertRowid, username, gender, age: Number(age), state, country, isGuest: true },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
