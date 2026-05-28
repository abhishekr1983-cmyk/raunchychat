const { createClient } = require('@libsql/client');
const path = require('path');

// Production: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN env vars
// Local dev: falls back to a local SQLite file
const url = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'chat.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const client = createClient({ url, authToken });

async function initDB() {
  // Create tables
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

  // Single global room — upsert so we don't duplicate on restart
  await client.execute('DELETE FROM rooms');
  await client.execute({
    sql: 'INSERT INTO rooms (id, name, description) VALUES (1, ?, ?)',
    args: ['Global', 'Everyone is here'],
  });

  console.log('Database ready');
}

module.exports = { client, initDB };
