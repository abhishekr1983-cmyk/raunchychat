const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const seo = require('./seo');

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
app.use(compression());
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

// ── SEO: robots, sitemap, server-rendered content pages ──────
app.get('/robots.txt', (_, res) => res.type('text/plain').send(seo.ROBOTS));
app.get('/sitemap.xml', (_, res) => res.type('application/xml').send(seo.sitemap()));
app.get('*', (req, res, next) => {
  const html = seo.renderPage(req.path.replace(/\/+$/, '') || '/');
  if (!html) return next();
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('html').send(html);
});

// ── Serve built React client with injected meta tags ──────────
const distPath = path.join(__dirname, '../client/dist');
// index: false so index.html falls through to our wildcard (for meta injection)
app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(distPath, { index: false, maxAge: '1d' }));

// Only real SPA routes get the app shell; everything else is a true 404 (no soft-404s)
const SPA_ROUTES = /^\/(chat|admin|conference\/[^/]+)?\/?$/;

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  if (!SPA_ROUTES.test(req.path)) return res.status(404).type('html').send(seo.notFoundPage());

  const htmlPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(htmlPath)) return res.status(404).send('Client not built');

  let html = fs.readFileSync(htmlPath, 'utf8');
  const isHome = req.path === '/';

  const s = cachedSettings;
  const title   = esc(s.meta_title       || 'Free Adult Chat Rooms — Chat with Strangers | RaunchyChat');
  const desc    = esc(s.meta_description || 'Free adult chat rooms for 18+. Chat with strangers worldwide by text, voice and video — anonymous, no signup, no download. Start chatting in seconds.');
  const siteName = esc(s.site_name       || 'RaunchyChat');

  const metaTags = `
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${seo.SITE}${isHome ? '/' : req.path}" />
  <meta name="rating" content="adult" />
  <meta name="robots" content="${isHome ? 'index,follow,max-image-preview:large' : 'noindex,follow'}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${seo.SITE}/" />
  <meta property="og:image" content="${seo.SITE}/og.png" />
  <meta property="og:site_name" content="${siteName}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image" content="${seo.SITE}/og.png" />
  ${isHome ? seo.HOME_LD.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n  ') : ''}`;

  html = html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace('</head>', `${metaTags}\n  </head>`);
  if (isHome) html = html.replace('<div id="root"></div>', `<div id="root">${seo.HOME_STATIC}</div>`);

  if (!isHome) res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('Cache-Control', 'no-cache');
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
