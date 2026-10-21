// ── SEO: server-rendered content pages, sitemap, robots, structured data ──
// The React app is a client-only SPA, so every crawlable word lives here.
const SITE = 'https://www.raunchychat.com';
const BRAND = 'RaunchyChat';
const UPDATED = '2026-10-21';

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Topic pages ───────────────────────────────────────────────
const TOPICS = [
  {
    slug: 'chat-with-strangers',
    title: 'Chat with Strangers Online — Free, No Signup',
    h1: 'Chat with Strangers Online',
    desc: 'Chat with strangers online for free on RaunchyChat. No signup, no download — pick a nickname and start talking to real people worldwide in seconds.',
    intro: 'Talking to someone new is the fastest cure for a boring night. RaunchyChat drops you into a live room full of real people from around the world — no account, no app, no payment. Pick a nickname, choose your country and you are chatting in under ten seconds.',
    sections: [
      ['How stranger chat works', 'Enter a nickname, gender, country and age on the home page and press <em>Start Chatting</em>. You join the main room instantly, see who is online, and can open a private one-to-one conversation with anyone who accepts. Guest sessions last 24 hours; register a free account to keep your nickname, profile and friends.'],
      ['Why people use RaunchyChat', 'It is quick, it is free and it works in any modern browser on phone or desktop. You can stay anonymous, filter who you talk to by country, and move from text to voice or video when you both want to.'],
      ['Stay safe while chatting', 'Never share your address, workplace, passwords or bank details. Use the block and report buttons the moment someone makes you uncomfortable — moderators review reports and automated filters catch abusive words. Read our <a href="/safety">safety guide</a> for more.'],
    ],
    faq: [
      ['Is chatting with strangers on RaunchyChat free?', 'Yes. Text chat, private messages and public rooms are completely free, with no signup required.'],
      ['Do I need to download an app?', 'No. RaunchyChat runs in your browser on Android, iPhone, Windows and Mac. You can optionally install it as a web app from your browser menu.'],
      ['Can I stay anonymous?', 'Yes. Guests only choose a nickname — no email or phone number is needed.'],
    ],
  },
  {
    slug: 'random-chat',
    title: 'Random Chat — Meet Random People Online Free',
    h1: 'Random Chat with Real People',
    desc: 'Free random chat with real people online. Jump into a live room, meet random strangers from any country and chat by text, voice or video on RaunchyChat.',
    intro: 'Random chat is about the surprise: you never know who you will meet next. RaunchyChat keeps a live room busy around the clock, so there is always someone new to say hello to — whether you want small talk, flirting or a long late-night conversation.',
    sections: [
      ['Meet someone new every time', 'The online list updates in real time. Browse people by country, gender and age, then start a private chat with one tap. If the conversation fizzles, just move on to the next person.'],
      ['Text, voice and video', 'Start with text, and when you both feel comfortable, switch to a voice or video call right inside the chat — no phone number exchange needed.'],
      ['Better than old random chat sites', 'Classic random chat sites closed or filled up with bots and spam. RaunchyChat uses word filters, rate limits, blocking and human moderation to keep rooms usable.'],
    ],
    faq: [
      ['What is random chat?', 'Random chat lets you talk with people you have never met, chosen from whoever is online at that moment.'],
      ['Is RaunchyChat a good Omegle alternative?', 'Yes — it offers free anonymous text chat plus optional voice and video, works on mobile, and has blocking and reporting built in.'],
      ['Is random chat safe?', 'It is as safe as you make it. Stay anonymous, never send money or personal details, and block anyone who behaves badly.'],
    ],
  },
  {
    slug: 'adult-chat',
    title: 'Free Adult Chat Rooms (18+) — RaunchyChat',
    h1: 'Free Adult Chat Rooms for 18+',
    desc: 'Free adult chat rooms for over-18s. Flirt, meet singles and talk openly with consenting adults by text, voice or video — anonymous and no signup on RaunchyChat.',
    intro: 'RaunchyChat is built for adults who want to talk freely. Flirt, meet singles and have open conversations with other consenting grown-ups — anonymously, for free, and without handing over your email.',
    sections: [
      ['Strictly 18+', 'Every user confirms they are 18 or older. Anyone found to be under 18 is removed immediately. If you see someone who looks underage, report them — we act on every report.'],
      ['Consent comes first', 'Adult chat only works when both people want it. Do not send explicit messages or start a call with someone who has not agreed. Unwanted harassment gets accounts blocked.'],
      ['Privacy for grown-ups', 'Use a nickname that is not your real name, keep identifying photos to yourself and remember that anything you share can be screenshotted. Our <a href="/privacy">privacy policy</a> explains exactly what we store.'],
    ],
    faq: [
      ['Are the adult chat rooms free?', 'Yes, all public rooms and private messaging are free.'],
      ['How do you keep minors out?', 'Users must confirm they are 18+, profiles that appear underage are removed, and every report is reviewed by moderators.'],
      ['Can I meet singles near me?', 'You can filter people by country and see their state or region, which makes it easy to find people nearby.'],
    ],
  },
  {
    slug: 'video-chat',
    title: 'Free Video Chat with Strangers — RaunchyChat',
    h1: 'Free Video Chat with Strangers',
    desc: 'Start a free video chat with strangers right in your browser. Meet people by text first, then switch to a private voice or video call on RaunchyChat.',
    intro: 'Text is great for breaking the ice, but sometimes you want to see who you are talking to. On RaunchyChat you can upgrade any private chat to a voice or video call with one tap — browser to browser, no app needed.',
    sections: [
      ['Chat first, call when you are ready', 'Unlike cam roulette sites that throw you straight onto camera, RaunchyChat lets you get to know someone by text before either of you turns a camera on. Calls only start when the other person accepts.'],
      ['Group video conferences', 'Create a conference room and share the link to bring several people into the same video call.'],
      ['Works on any device', 'Video chat works in Chrome, Safari, Firefox and Edge on phones, tablets and computers. Allow camera and microphone access when your browser asks.'],
    ],
    faq: [
      ['Is video chat free?', 'Yes. Voice and video calls between users are free.'],
      ['Can someone call me without permission?', 'No. Every call must be accepted, and you can block a user at any time.'],
      ['Why is my camera not working?', 'Check that your browser has permission to use the camera and microphone, and that no other app is using them.'],
    ],
  },
  {
    slug: 'chat-rooms',
    title: 'Free Online Chat Rooms — No Registration',
    h1: 'Free Online Chat Rooms',
    desc: 'Join free online chat rooms with no registration. Live public rooms, private messages and voice & video calls with people from over 100 countries.',
    intro: 'Remember when chat rooms were the best part of the internet? RaunchyChat brings them back: busy public rooms, private one-to-one messages and a live list of who is online — all free and without registration.',
    sections: [
      ['Public rooms and private chats', 'Talk to everyone in the main room or open a private conversation. Registered members can create their own rooms too.'],
      ['People from everywhere', 'Users join from the USA, UK, India, Canada, Australia and dozens of other countries. Browse by country to find people in your time zone, or see our <a href="/countries">country chat rooms</a>.'],
      ['Moderated, not sterile', 'Rooms are open and relaxed, but spam, scams and abuse are filtered and moderated so conversations stay fun.'],
    ],
    faq: [
      ['Do I need to register to use the chat rooms?', 'No. Guests can join instantly with just a nickname. Registering is free and keeps your profile.'],
      ['Are there chat rooms on mobile?', 'Yes, the site is fully mobile friendly.'],
      ['How many people are online?', 'The live count is shown at the top of the home page and updates in real time.'],
    ],
  },
  {
    slug: 'omegle-alternative',
    title: 'Best Omegle Alternative in 2026 — Free Stranger Chat',
    h1: 'The Omegle Alternative That Still Works',
    desc: 'Looking for an Omegle alternative after Omegle shut down? RaunchyChat offers free anonymous stranger chat with text, voice and video — plus blocking and moderation.',
    intro: 'Omegle closed for good in November 2023, and many of the copycats that followed are full of bots. RaunchyChat is a modern alternative: real people, anonymous by default, and tools to block anyone who ruins the vibe.',
    sections: [
      ['What you get', 'Anonymous guest chat, a live list of who is online, country filters, private messages, voice and video calls, friends and profiles — all free.'],
      ['What is different', 'Instead of pairing you blindly with one camera, you can see who is online and choose who to talk to. Calls only start when both people agree.'],
      ['Adults only', 'RaunchyChat is for people aged 18 and over. That keeps conversations adult and lets us remove minors quickly.'],
    ],
    faq: [
      ['Why did Omegle shut down?', 'Omegle\'s founder closed the service in November 2023, citing the cost of fighting misuse.'],
      ['Is RaunchyChat like Omegle?', 'It shares the idea of anonymous chat with strangers, but adds a live user list, country filters, friends, blocking and moderation.'],
      ['Is it free?', 'Yes, chatting is free.'],
    ],
  },
  {
    slug: 'anonymous-chat',
    title: 'Anonymous Chat — Talk Freely Without Signup',
    h1: 'Anonymous Chat Online',
    desc: 'Free anonymous chat with no email, no phone number and no signup. Talk freely with strangers on RaunchyChat and leave whenever you want.',
    intro: 'Sometimes you just want to talk without anyone knowing who you are. RaunchyChat guest sessions need only a nickname — no email, no phone number — and expire automatically after 24 hours.',
    sections: [
      ['What we know about you', 'For a guest, only the nickname, gender, country and age you type in, plus technical data needed to stop abuse. See the <a href="/privacy">privacy policy</a>.'],
      ['Keep it anonymous', 'Avoid using your real name or a username you use elsewhere, and do not share photos that show your face or location unless you trust the person.'],
      ['Vent, flirt or just talk', 'Anonymity makes it easier to be honest. Whether you want to talk about your day, your feelings or nothing at all, there is someone online who will listen.'],
    ],
    faq: [
      ['Is anonymous chat really anonymous?', 'Other users only see your nickname and the profile details you choose. We keep minimal technical logs to fight spam and abuse.'],
      ['Do guest accounts expire?', 'Yes, guest sessions expire after 24 hours.'],
      ['Can I delete my account?', 'Registered users can ask for deletion at any time.'],
    ],
  },
];

// ── Country pages ─────────────────────────────────────────────
const COUNTRIES = [
  ['usa', 'USA', 'American', 'from New York to Los Angeles, Texas to Florida'],
  ['uk', 'UK', 'British', 'from London, Manchester, Birmingham, Glasgow and beyond'],
  ['india', 'India', 'Indian', 'from Delhi, Mumbai, Bangalore, Kolkata and every state'],
  ['canada', 'Canada', 'Canadian', 'from Toronto, Vancouver, Montreal and Calgary'],
  ['australia', 'Australia', 'Australian', 'from Sydney, Melbourne, Brisbane and Perth'],
  ['philippines', 'Philippines', 'Filipino', 'from Manila, Cebu, Davao and across the islands'],
  ['pakistan', 'Pakistan', 'Pakistani', 'from Karachi, Lahore, Islamabad and beyond'],
  ['germany', 'Germany', 'German', 'from Berlin, Munich, Hamburg and Cologne'],
  ['south-africa', 'South Africa', 'South African', 'from Johannesburg, Cape Town and Durban'],
  ['nigeria', 'Nigeria', 'Nigerian', 'from Lagos, Abuja and Port Harcourt'],
  ['uae', 'UAE', 'UAE', 'from Dubai, Abu Dhabi and Sharjah'],
  ['ireland', 'Ireland', 'Irish', 'from Dublin, Cork and Galway'],
].map(([slug, name, adj, places]) => ({
  slug: `country/${slug}`,
  name,
  title: `${name} Chat Rooms — Free ${adj} Chat with Strangers`,
  h1: `Free ${name} Chat Rooms`,
  desc: `Chat with people in ${name} for free. Join ${adj} chat rooms, meet strangers ${places.split(',')[0].replace(/^from /, 'in ')} and more — no signup, text, voice and video on RaunchyChat.`,
  intro: `Want to talk to people in ${name}? RaunchyChat has members online ${places}. Choose ${name} as your country, filter the online list and start a free private chat — no registration needed.`,
  sections: [
    [`Find people in ${name}`, `After you join, filter the online list by country to see who is chatting from ${name}. Profiles show region and age, so you can find people in your own time zone or close to home.`],
    ['Text first, then voice or video', 'Break the ice with messages and switch to a private voice or video call when you both agree. Everything runs in your browser.'],
    ['Free and anonymous', 'Guests only need a nickname. Register for free if you want a permanent profile, friends list and your own rooms.'],
  ],
  faq: [
    [`Is ${name} chat free?`, 'Yes, chatting on RaunchyChat is free.'],
    [`Can I only talk to people from ${name}?`, 'You can filter the online list by country, but you are also free to talk to anyone worldwide.'],
    ['Do I need to sign up?', 'No — enter a nickname and start chatting as a guest.'],
  ],
}));

// ── Info pages ────────────────────────────────────────────────
const INFO = {
  about: {
    title: 'About RaunchyChat',
    desc: 'RaunchyChat is a free, browser-based chat community for adults to meet strangers by text, voice and video. Learn who we are and how the site works.',
    body: `<p>RaunchyChat is a free chat community for adults (18+). It brings back the classic chat-room experience — live rooms, a list of who is online and private messages — and adds modern voice and video calling that runs right in the browser.</p>
<h2>How it works</h2><p>Pick a nickname, choose your gender, country and age, and you are in. Guests can chat for 24 hours; registering is free and keeps your profile, friends and rooms.</p>
<h2>Our rules</h2><ul><li>You must be 18 or older.</li><li>Respect consent — no unwanted explicit messages or calls.</li><li>No spam, scams, selling or advertising.</li><li>No hate speech, threats or illegal content.</li></ul>
<p>Breaking the rules gets accounts blocked. Read the full <a href="/terms">terms</a> and our <a href="/safety">safety tips</a>.</p>`,
  },
  safety: {
    title: 'Online Chat Safety Tips',
    desc: 'How to stay safe when chatting with strangers online: protect your privacy, spot scams and catfish, and use blocking and reporting on RaunchyChat.',
    body: `<p>Most people online are just looking for a good conversation, but a few are not. These habits keep you in control.</p>
<h2>Protect your identity</h2><ul><li>Use a nickname you do not use anywhere else.</li><li>Never share your home address, workplace, school or daily routine.</li><li>Be careful with photos — backgrounds, uniforms and landmarks can reveal where you are.</li></ul>
<h2>Spot scams</h2><ul><li>Nobody genuine will ask you for money, gift cards or crypto.</li><li>Be wary of anyone who quickly pushes you to another app or a "verification" link.</li><li>Sextortion is real: if someone threatens to share images, do not pay — block, report and contact local police.</li></ul>
<h2>Use the tools</h2><p>Block anyone who makes you uncomfortable and report them so moderators can act. Calls only connect when you accept them.</p>
<h2>Get help</h2><p>If you are in danger, contact your local emergency number. In the US you can reach the Cyber Civil Rights Initiative helpline at 844-878-2274; in the UK, the Revenge Porn Helpline at 0345 6000 459.</p>`,
  },
  privacy: {
    title: 'Privacy Policy',
    desc: 'RaunchyChat privacy policy: what data we collect, why, how long we keep it and how to ask for deletion.',
    body: `<p><em>Last updated ${UPDATED}.</em></p>
<h2>What we collect</h2><ul><li><strong>Profile details you enter</strong> — nickname, gender, age, country and region, and optionally email, bio and interests for registered users.</li><li><strong>Messages</strong> you send in rooms and private chats, so they can be delivered and moderated.</li><li><strong>Technical data</strong> — IP address and last-seen time, used to prevent spam and abuse.</li></ul>
<h2>What we do not do</h2><p>We do not sell your personal data. Voice and video calls are connected peer-to-peer and are not recorded by us.</p>
<h2>Retention</h2><p>Guest sessions expire after 24 hours. Registered accounts are kept until you ask us to delete them.</p>
<h2>Your rights</h2><p>You can ask for a copy or deletion of your data at any time by contacting the site administrator through the chat.</p>
<h2>Cookies</h2><p>We store a login token in your browser so you stay signed in. We do not use advertising cookies.</p>`,
  },
  terms: {
    title: 'Terms of Use',
    desc: 'RaunchyChat terms of use: 18+ only, consent and conduct rules, prohibited content and account blocking.',
    body: `<p><em>Last updated ${UPDATED}.</em></p>
<h2>Eligibility</h2><p>You must be at least 18 years old (or the age of majority where you live) to use RaunchyChat.</p>
<h2>Conduct</h2><ul><li>Treat others with respect and get consent before sending sexual content or starting a call.</li><li>No harassment, hate speech, threats, doxxing or impersonation.</li><li>No spam, advertising, solicitation or scams.</li><li>No content involving minors, non-consensual imagery or anything illegal where you or the recipient live. We report child sexual abuse material to the authorities.</li></ul>
<h2>Moderation</h2><p>We may filter messages, remove content and block accounts that break these terms, with or without notice.</p>
<h2>No warranty</h2><p>The service is provided as is. You are responsible for what you share and who you share it with.</p>`,
  },
};

// ── Shared HTML shell ─────────────────────────────────────────
const CSS = `*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;background:#f8fafc;line-height:1.65}
a{color:#2563eb}header,footer{background:#fff;border-bottom:1px solid #e5e7eb}header .w{display:flex;align-items:center;justify-content:space-between;height:60px}
.w{max-width:860px;margin:0 auto;padding:0 16px}.logo{font-weight:700;font-size:20px;color:#1f2937;text-decoration:none}
.cta{display:inline-block;background:#2563eb;color:#fff;padding:12px 22px;border-radius:10px;font-weight:600;text-decoration:none}
.cta.sm{padding:8px 14px;font-size:14px}main{padding:32px 0 48px}h1{font-size:clamp(28px,5vw,40px);line-height:1.2;margin:8px 0 16px}
h2{font-size:22px;margin:32px 0 8px}.lead{font-size:18px;color:#374151}.crumb{font-size:14px;color:#6b7280}.crumb a{color:#6b7280}
.box{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px 24px;margin:28px 0}details{border-top:1px solid #e5e7eb;padding:12px 0}
summary{font-weight:600;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;padding:0;list-style:none}
.grid a{display:block;padding:10px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;text-decoration:none;color:#1f2937}
footer{border-top:1px solid #e5e7eb;border-bottom:0;padding:28px 0;font-size:14px;color:#6b7280}footer a{color:#4b5563;margin-right:14px;line-height:2}
.age{font-size:13px;color:#6b7280;margin-top:10px}`;

const NAV_TOPICS = TOPICS.map((t) => [`/${t.slug}`, t.h1.replace(/ Online$/, '')]);

function footer() {
  return `<footer><div class="w">
<div>${NAV_TOPICS.map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join('')}</div>
<div><a href="/countries">Chat rooms by country</a><a href="/about">About</a><a href="/safety">Safety</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
<p>© ${new Date().getFullYear()} ${BRAND} · Adults 18+ only</p></div></footer>`;
}

function shell({ path, title, desc, body, jsonld = [] }) {
  const url = SITE + path;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta name="rating" content="adult"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:site_name" content="${BRAND}"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#2563eb">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon-192.png">
<style>${CSS}</style>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head><body><header><div class="w"><a class="logo" href="/">🔥 ${BRAND}</a><a class="cta sm" href="/">Start chatting</a></div></header>
<main><div class="w">${body}</div></main>${footer()}</body></html>`;
}

function crumbs(items) {
  const html = `<nav class="crumb"><a href="/">Home</a>${items.map(([h, l]) => ` › ${h ? `<a href="${h}">${esc(l)}</a>` : esc(l)}`).join('')}</nav>`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [['/', 'Home'], ...items].map(([h, l], i) => ({ '@type': 'ListItem', position: i + 1, name: l, ...(h ? { item: SITE + h } : {}) })),
  };
  return { html, ld };
}

function ctaBox(text) {
  return `<div class="box"><strong>${esc(text)}</strong><p>No signup, no download. Pick a nickname and you are in.</p><a class="cta" href="/">Start chatting free →</a><div class="age">🔞 Adults 18+ only</div></div>`;
}

function contentPage(p, path, parent) {
  const c = crumbs(parent ? [parent, [null, p.h1]] : [[null, p.h1]]);
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  const related = TOPICS.filter((t) => `/${t.slug}` !== path).slice(0, 6);
  const body = `${c.html}<h1>${esc(p.h1)}</h1><p class="lead">${p.intro}</p>${ctaBox('Ready to meet someone new?')}
${p.sections.map(([h, t]) => `<h2>${esc(h)}</h2><p>${t}</p>`).join('\n')}
<h2>Frequently asked questions</h2>${p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
${ctaBox('Thousands of conversations are happening right now.')}
<h2>Explore more</h2><ul class="grid">${related.map((t) => `<li><a href="/${t.slug}">${esc(t.h1)}</a></li>`).join('')}<li><a href="/countries">Chat rooms by country</a></li></ul>`;
  return shell({ path, title: p.title, desc: p.desc, body, jsonld: [c.ld, faqLd] });
}

function countryHub() {
  const path = '/countries';
  const c = crumbs([[null, 'Chat rooms by country']]);
  const body = `${c.html}<h1>Chat Rooms by Country</h1><p class="lead">Meet people near you or on the other side of the world. Pick a country to learn more, then filter the online list once you join.</p>
<ul class="grid">${COUNTRIES.map((k) => `<li><a href="/${k.slug}">${esc(k.name)} chat</a></li>`).join('')}</ul>${ctaBox('Or just jump in and talk to everyone.')}`;
  return shell({ path, title: 'Chat Rooms by Country — Free Local Chat | RaunchyChat', desc: 'Free chat rooms by country: USA, UK, India, Canada, Australia and more. Meet strangers near you by text, voice or video on RaunchyChat.', body, jsonld: [c.ld] });
}

function infoPage(key) {
  const p = INFO[key];
  const c = crumbs([[null, p.title]]);
  return shell({ path: `/${key}`, title: `${p.title} | ${BRAND}`, desc: p.desc, body: `${c.html}<h1>${esc(p.title)}</h1>${p.body}${ctaBox('Start a conversation')}`, jsonld: [c.ld] });
}

function notFoundPage() {
  return shell({ path: '/404', title: `Page not found | ${BRAND}`, desc: 'This page does not exist.', body: `<h1>Page not found</h1><p>That page does not exist. Try one of these instead:</p><ul class="grid">${NAV_TOPICS.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')}</ul>${ctaBox('Or start chatting now')}` })
    .replace('index,follow,max-image-preview:large', 'noindex');
}

// ── Pages map, sitemap, robots ────────────────────────────────
const PAGES = new Map();
for (const t of TOPICS) PAGES.set(`/${t.slug}`, () => contentPage(t, `/${t.slug}`));
PAGES.set('/countries', countryHub);
for (const k of COUNTRIES) PAGES.set(`/${k.slug}`, () => contentPage(k, `/${k.slug}`, ['/countries', 'Chat rooms by country']));
for (const key of Object.keys(INFO)) PAGES.set(`/${key}`, () => infoPage(key));

const cache = new Map();
function renderPage(path) {
  if (!PAGES.has(path)) return null;
  if (!cache.has(path)) cache.set(path, PAGES.get(path)());
  return cache.get(path);
}

function sitemap() {
  const urls = [['/', '1.0', 'daily'], ...[...PAGES.keys()].map((p) => [p, INFO[p.slice(1)] ? '0.3' : p.startsWith('/country/') ? '0.7' : '0.9', 'weekly'])];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, pr, f]) => `  <url><loc>${SITE}${p}</loc><lastmod>${UPDATED}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`;
}

const ROBOTS = `User-agent: *\nAllow: /\nAllow: /api/stats\nAllow: /api/admin/settings$\nDisallow: /api/\nDisallow: /admin\nDisallow: /conference/\n\nSitemap: ${SITE}/sitemap.xml\n`;

// Home page extras: structured data + crawlable intro/links (replaced when React mounts)
const HOME_LD = [
  { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: `${SITE}/` },
  { '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, url: `${SITE}/`, logo: `${SITE}/icon-512.png` },
  { '@context': 'https://schema.org', '@type': 'WebApplication', name: BRAND, url: `${SITE}/`, applicationCategory: 'CommunicationApplication', operatingSystem: 'Any (web browser)', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
];

const HOME_STATIC = `<main style="max-width:860px;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif">
<h1>Chat with Strangers Worldwide — Free Adult Chat Rooms</h1>
<p>RaunchyChat is a free chat site for adults (18+). Meet new people, flirt and make friends in live chat rooms, then move to private voice or video calls — no signup or download needed.</p>
<ul>${NAV_TOPICS.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')}<li><a href="/countries">Chat rooms by country</a></li></ul></main>`;

module.exports = { SITE, esc, renderPage, sitemap, ROBOTS, HOME_LD, HOME_STATIC, notFoundPage, NAV_TOPICS, COUNTRIES };
