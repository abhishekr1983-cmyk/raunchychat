const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { client } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { BOTS_BY_ID } = require('../bots');

const router = express.Router();

// Safely parse a JSON-array column; returns [] on any problem
function parseArr(val) {
  if (!val) return [];
  try { const a = JSON.parse(val); return Array.isArray(a) ? a : []; }
  catch { return []; }
}

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
    telegramId: row.telegram_id ? Number(row.telegram_id) : null,
    // ── Profile fields ──
    bio: row.bio || '',
    interests: parseArr(row.interests),
    lookingFor: parseArr(row.looking_for),
    relationshipStatus: row.relationship_status || '',
    orientation: row.orientation || '',
    languages: parseArr(row.languages),
    bodyType: row.body_type || '',
    height: row.height || '',
    avatarEmoji: row.avatar_emoji || '',
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

    if (row.is_blocked)
      return res.status(403).json({ error: 'Your account has been blocked. Contact support.' });

    await client.execute({
      sql: 'UPDATE users SET last_seen = ? WHERE id = ?',
      args: [new Date().toISOString(), Number(row.id)],
    });

    const token = jwt.sign({ userId: Number(row.id) }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: safeUser(row) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/guest', async (req, res) => {
  try {
    const { username, gender, age, state = 'N/A', country = 'International' } = req.body;

    if (!username || !gender || !age)
      return res.status(400).json({ error: 'Username, gender and age are required' });
    if (username.length < 3 || username.length > 24)
      return res.status(400).json({ error: 'Username must be 3–24 characters' });
    if (Number(age) < 18 || Number(age) > 120)
      return res.status(400).json({ error: 'Age must be 18 or older' });

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress || req.ip || 'unknown';
    const now = new Date().toISOString();

    const existing = (await client.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [username],
    })).rows[0];
    if (existing) return res.status(409).json({ error: 'Username already taken, please choose another' });

    const result = await client.execute({
      sql: 'INSERT INTO users (username, gender, age, state, country, is_guest, ip_address, last_seen) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      args: [username, gender, Number(age), state, country, ip, now],
    });

    const userId = Number(result.lastInsertRowid);
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: userId, username, gender, age: Number(age), state, country, isGuest: true, isAdmin: false } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Google Sign-In ─────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    // Verify token with Google
    const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    const payload = await gRes.json();
    if (payload.error || !payload.email) return res.status(401).json({ error: 'Invalid Google token' });

    const { email, name, sub: googleId } = payload;
    // derive username from name, max 24 chars, alphanumeric+underscore
    let username = (name || email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user';

    // find by google_id or email
    let row = (await client.execute({ sql: 'SELECT * FROM users WHERE google_id = ? OR (email = ? AND is_guest = 0)', args: [googleId, email] })).rows[0];

    if (!row) {
      // ensure unique username
      let finalUsername = username;
      const existing = (await client.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [finalUsername] })).rows[0];
      if (existing) finalUsername = `${username.slice(0,18)}_${Math.floor(Math.random()*99)}`;

      const result = await client.execute({
        sql: `INSERT INTO users (username, email, gender, age, state, country, is_guest, is_admin, google_id)
              VALUES (?, ?, 'Prefer not to say', 25, 'N/A', 'International', 0, 0, ?)`,
        args: [finalUsername, email, googleId],
      });
      row = (await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [Number(result.lastInsertRowid)] })).rows[0];
    } else if (!row.google_id) {
      await client.execute({ sql: 'UPDATE users SET google_id = ? WHERE id = ?', args: [googleId, Number(row.id)] });
    }

    const token = jwt.sign({ userId: Number(row.id) }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: safeUser(row) });
  } catch (err) {
    console.error('[google-auth]', err.message);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// ── Telegram Login ─────────────────────────────────────────────
router.post('/telegram', async (req, res) => {
  try {
    const data = req.body; // { id, first_name, last_name?, username?, auth_date, hash, ... }
    if (!data.hash || !data.auth_date || !data.id) {
      return res.status(400).json({ error: 'Invalid Telegram auth data' });
    }

    // Load bot token from settings
    const tokenRow = (await client.execute({
      sql: "SELECT value FROM site_settings WHERE key = 'telegram_bot_token'",
      args: [],
    })).rows[0];

    if (!tokenRow?.value?.trim()) {
      return res.status(400).json({ error: 'Telegram integration is not configured on this server' });
    }

    // Verify HMAC-SHA256 signature
    const { hash, ...rest } = data;
    const checkString = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k]}`)
      .join('\n');
    const secretKey = crypto.createHash('sha256').update(tokenRow.value.trim()).digest();
    const computed = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (computed !== hash) {
      return res.status(401).json({ error: 'Telegram auth verification failed' });
    }

    // Reject stale auth (older than 1 hour)
    if (Date.now() / 1000 - parseInt(data.auth_date) > 3600) {
      return res.status(401).json({ error: 'Telegram auth data expired, please try again' });
    }

    const telegramId = Number(data.id);
    const telegramUsername = (data.username || `tg${telegramId}`).slice(0, 24);

    // Find existing user by telegram_id
    let row = (await client.execute({
      sql: 'SELECT * FROM users WHERE telegram_id = ?',
      args: [telegramId],
    })).rows[0];

    let isNewUser = false;

    if (!row) {
      // Generate a unique username
      let username = telegramUsername;
      for (let i = 1; i <= 20; i++) {
        const clash = (await client.execute({
          sql: 'SELECT id FROM users WHERE username = ?',
          args: [username],
        })).rows[0];
        if (!clash) break;
        username = `${telegramUsername.slice(0, 21)}_${i}`;
      }

      const result = await client.execute({
        sql: `INSERT INTO users
                (username, gender, age, state, country, is_guest,
                 telegram_id, telegram_username, last_seen)
              VALUES (?, 'Prefer not to say', 18, 'Global', 'Global', 0, ?, ?, ?)`,
        args: [username, telegramId, data.username || null, new Date().toISOString()],
      });

      row = (await client.execute({
        sql: 'SELECT * FROM users WHERE id = ?',
        args: [Number(result.lastInsertRowid)],
      })).rows[0];

      isNewUser = true;
      console.log(`[telegram] New user: ${username} (tg_id=${telegramId})`);
    } else {
      if (row.is_blocked) {
        return res.status(403).json({ error: 'Your account has been blocked.' });
      }
      await client.execute({
        sql: 'UPDATE users SET last_seen = ? WHERE id = ?',
        args: [new Date().toISOString(), Number(row.id)],
      });
    }

    const token = jwt.sign({ userId: Number(row.id) }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: safeUser(row), isNewUser });
  } catch (err) {
    console.error('[telegram auth]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Profile update (for Telegram users who need to set gender/age/country) ──
router.put('/profile', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
    const { userId } = jwt.verify(auth.slice(7), JWT_SECRET);

    const { gender, age, state, country } = req.body;
    if (!gender || !age || !country) return res.status(400).json({ error: 'gender, age and country are required' });
    if (Number(age) < 18 || Number(age) > 120) return res.status(400).json({ error: 'Age must be 18–120' });

    await client.execute({
      sql: 'UPDATE users SET gender = ?, age = ?, state = ?, country = ? WHERE id = ?',
      args: [gender, Number(age), state || 'N/A', country, Number(userId)],
    });

    const row = (await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [Number(userId)] })).rows[0];
    res.json({ user: safeUser(row) });
  } catch (err) {
    console.error('[profile update]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Full profile update (bio, interests, hobbies, etc.) ──────────
const RELATIONSHIP_OPTS = ['Single', 'Taken', 'Married', 'Open relationship', "It's complicated", 'Prefer not to say'];
const ORIENTATION_OPTS  = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Curious', 'Prefer not to say'];
const BODY_OPTS         = ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Plus-size', 'Prefer not to say'];
const LOOKING_OPTS      = ['Friendship', 'Casual chat', 'Dating', 'Relationship', 'Flirting', 'Roleplay', 'Just here for fun'];

function cleanList(arr, max = 15, maxLen = 30) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(
    arr.map((x) => String(x).trim().slice(0, maxLen)).filter(Boolean)
  )].slice(0, max);
}

router.put('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
    const { userId } = jwt.verify(auth.slice(7), JWT_SECRET);

    const b = req.body || {};

    // Validate the editable standard fields if provided
    const gender  = b.gender ? String(b.gender) : null;
    const age     = b.age != null ? Number(b.age) : null;
    if (age != null && (age < 18 || age > 120)) return res.status(400).json({ error: 'Age must be 18–120' });

    // Whitelist-validate option fields (allow '' to clear)
    const rel = b.relationshipStatus && RELATIONSHIP_OPTS.includes(b.relationshipStatus) ? b.relationshipStatus : '';
    const ori = b.orientation && ORIENTATION_OPTS.includes(b.orientation) ? b.orientation : '';
    const body = b.bodyType && BODY_OPTS.includes(b.bodyType) ? b.bodyType : '';
    const lookingFor = cleanList((b.lookingFor || []).filter((x) => LOOKING_OPTS.includes(x)), 7);

    const bio        = String(b.bio || '').slice(0, 500);
    const interests  = cleanList(b.interests, 15);
    const languages  = cleanList(b.languages, 10, 20);
    const height     = String(b.height || '').slice(0, 20);
    const avatarEmoji = String(b.avatarEmoji || '').slice(0, 8);

    // Build a dynamic UPDATE so we don't overwrite standard fields when omitted
    const sets = [
      'bio = ?', 'interests = ?', 'looking_for = ?', 'relationship_status = ?',
      'orientation = ?', 'languages = ?', 'body_type = ?', 'height = ?', 'avatar_emoji = ?',
    ];
    const args = [
      bio, JSON.stringify(interests), JSON.stringify(lookingFor), rel,
      ori, JSON.stringify(languages), body, height, avatarEmoji,
    ];
    if (gender) { sets.push('gender = ?'); args.push(gender); }
    if (age != null) { sets.push('age = ?'); args.push(age); }
    if (b.country) { sets.push('country = ?'); args.push(String(b.country)); }
    if (b.state != null) { sets.push('state = ?'); args.push(String(b.state)); }

    args.push(Number(userId));
    await client.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args });

    const row = (await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [Number(userId)] })).rows[0];
    res.json({ user: safeUser(row) });
  } catch (err) {
    console.error('[profile /me update]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Fetch a user's public profile (for viewing others) ──────────
router.get('/profile/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(404).json({ error: 'Profile not found' });

    // Bots have negative IDs and live in memory, not the DB
    if (id < 0) {
      const bot = BOTS_BY_ID.get(id);
      if (!bot) return res.status(404).json({ error: 'Profile not found' });
      return res.json({ user: { ...bot, lookingFor: bot.lookingFor || [], avatarEmoji: bot.avatarEmoji || '' } });
    }

    const row = (await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] })).rows[0];
    if (!row) return res.status(404).json({ error: 'Profile not found' });

    const u = safeUser(row);
    // Strip private fields for public view
    delete u.email;
    delete u.telegramId;
    res.json({ user: u });
  } catch (err) {
    console.error('[get profile]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Expose option lists so the client and server stay in sync
router.get('/profile-options', (_, res) => {
  res.json({
    relationshipStatus: RELATIONSHIP_OPTS,
    orientation: ORIENTATION_OPTS,
    bodyType: BODY_OPTS,
    lookingFor: LOOKING_OPTS,
  });
});

module.exports = router;
