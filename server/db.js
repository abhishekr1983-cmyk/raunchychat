const { createClient } = require('@libsql/client');
const path = require('path');

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'chat.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const client = createClient({ url, authToken });

async function initDB() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT,
      gender TEXT NOT NULL,
      age INTEGER NOT NULL,
      state TEXT NOT NULL,
      country TEXT NOT NULL,
      is_guest INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Idempotent migrations: add columns to existing DBs that predate them
  const migrations = [
    'ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN ip_address TEXT',
    'ALTER TABLE users ADD COLUMN last_seen DATETIME',
    'ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN violation_count INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN telegram_id INTEGER',
    'ALTER TABLE users ADD COLUMN telegram_username TEXT',
  ];
  for (const sql of migrations) {
    try { await client.execute(sql); } catch { /* column already exists — fine */ }
  }

  // Blocked words table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS blocked_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Violations / audit log
  await client.execute(`
    CREATE TABLE IF NOT EXISTS violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      matched_word TEXT NOT NULL,
      message TEXT NOT NULL,
      auto_blocked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default blocked words (violence / threats)
  const defaultWords = [
    'kill yourself', 'kys', 'go die', 'i will kill you', 'i will rape you',
    'i will hurt you', 'bomb threat', 'shoot you', 'stab you',
    'hang yourself', 'i will find you', 'you will die',
  ];
  for (const word of defaultWords) {
    try {
      await client.execute({
        sql: 'INSERT INTO blocked_words (word) VALUES (?)',
        args: [word],
      });
    } catch { /* already seeded */ }
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS private_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default site settings (only if not present)
  const defaults = [
    ['site_name', 'RaunchyChat'],
    ['site_logo', '🔥'],
    ['site_tagline', 'Meet. Flirt. Connect.'],
    ['meta_title', 'RaunchyChat — Meet & Chat Online'],
    ['meta_description', 'Free adult chat rooms. Meet new people from around the world anonymously. No sign-up required.'],
    ['meta_keywords', 'adult chat, free chat, anonymous chat, meet people online'],
    ['default_theme', 'dark-seduction'],
    ['ga_tracking_id', ''],
    ['custom_head_code', ''],
    ['custom_body_code', ''],
    ['auto_block_threshold', '3'],
    ['telegram_bot_username', ''],
    ['telegram_bot_token', ''],      // private — never exposed via public API
    ['telegram_channel_link', ''],
  ];
  for (const [key, value] of defaults) {
    try {
      await client.execute({
        sql: 'INSERT INTO site_settings (key, value) VALUES (?, ?)',
        args: [key, value],
      });
    } catch { /* already exists — fine */ }
  }

  await client.execute('DELETE FROM rooms');
  await client.execute({
    sql: 'INSERT INTO rooms (id, name, description) VALUES (1, ?, ?)',
    args: ['Global', 'Everyone is here'],
  });

  console.log('Database ready');
}

async function seedAdmin() {
  const bcrypt = require('bcryptjs');
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024!';

  const existing = (await client.execute({
    sql: 'SELECT id, is_admin FROM users WHERE username = ?',
    args: [adminUsername],
  })).rows[0];

  if (!existing) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await client.execute({
      sql: `INSERT INTO users (username, email, password_hash, gender, age, state, country, is_guest, is_admin)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      args: [adminUsername, `${adminUsername}@raunchychat.local`, hash, 'Prefer not to say', 30, 'Global', 'Global'],
    });
    console.log(`[admin] Created admin user  username="${adminUsername}"  password="${adminPassword}"`);
  } else if (!existing.is_admin) {
    // Ensure existing user is promoted to admin
    await client.execute({
      sql: 'UPDATE users SET is_admin = 1 WHERE username = ?',
      args: [adminUsername],
    });
    console.log(`[admin] Promoted "${adminUsername}" to admin`);
  }
}

module.exports = { client, initDB, seedAdmin };
