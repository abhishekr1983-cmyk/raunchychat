const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { initDB, seedAdmin, client } = require('./db');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const adminRoutes = require('./routes/admin');
const { setupSocketHandlers, refreshBlockedWords, getOnlineCount } = require('./socket/handlers');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again in 15 minutes.' },
});
app.use('/api/auth', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ── Public stats (live online count) ─────────────────────────
app.get('/api/stats', (_, res) => {
  res.json({ online: getOnlineCount() });
});

// ── Cached settings for SSR meta injection ────────────────────
let cachedSettings = {};

async function loadSettingsCache() {
  try {
    const result = await client.execute('SELECT key, value FROM site_settings');
    const s = {};
    for (const row of result.rows) s[row.key] = row.value;
    cachedSettings = s;
  } catch { /* use empty cache */ }
}

// Call this whenever admin updates settings
function invalidateSettingsCache() { loadSettingsCache(); }

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Serve built React client with injected meta tags ──────────
const distPath = path.join(__dirname, '../client/dist');
// index: false so index.html falls through to our wildcard (for meta injection)
app.use(express.static(distPath, { index: false }));

app.get('*', (_, res) => {
  const htmlPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(htmlPath)) return res.status(404).send('Client not built');

  let html = fs.readFileSync(htmlPath, 'utf8');

  const s = cachedSettings;
  const title   = esc(s.meta_title       || s.site_name     || 'RaunchyChat 🔥');
  const desc    = esc(s.meta_description || 'Meet real people — free adult chat, voice & video calls.');
  const kw      = esc(s.meta_keywords    || 'adult chat, free chat rooms, video chat, voice chat');
  const siteName = esc(s.site_name       || 'RaunchyChat');

  const metaTags = `
  <meta name="description" content="${desc}" />
  <meta name="keywords" content="${kw}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${siteName}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${desc}" />`;

  html = html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace('</head>', `${metaTags}\n  </head>`);

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

initDB()
  .then(() => seedAdmin())
  .then(() => refreshBlockedWords())
  .then(() => loadSettingsCache())
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = { invalidateSettingsCache };
