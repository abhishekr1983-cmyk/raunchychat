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

  // Idempotent migration: add is_admin to existing DBs that predate this column
  try {
    await client.execute('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  } catch { /* column already exists — fine */ }

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
