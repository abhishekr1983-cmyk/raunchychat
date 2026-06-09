import { createContext, useContext, useEffect, useState } from 'react';

const SiteSettingsContext = createContext(null);

const DEFAULTS = {
  site_name: 'RaunchyChat',
  site_logo: '🔥',
  site_tagline: 'Meet. Flirt. Connect.',
  meta_title: 'RaunchyChat — Meet & Chat Online',
  meta_description: 'Free adult chat rooms.',
  meta_keywords: 'adult chat, free chat, anonymous chat',
  default_theme: 'dark-seduction',
  ga_tracking_id: '',
  custom_head_code: '',
  custom_body_code: '',
  auto_block_threshold: '3',
  telegram_bot_username: '',   // bot token is PRIVATE — never in public settings
  telegram_channel_link: '',
};

// Safely inject HTML (including <script> tags) into a DOM container
function injectHtml(html, container, attrKey) {
  document.querySelectorAll(`[data-inject="${attrKey}"]`).forEach((el) => el.remove());
  if (!html || !html.trim()) return;

  const tpl = document.createElement('template');
  tpl.innerHTML = html;

  Array.from(tpl.content.childNodes).forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'SCRIPT') {
      const s = document.createElement('script');
      Array.from(node.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.textContent = node.textContent;
      s.setAttribute('data-inject', attrKey);
      container.appendChild(s);
    } else {
      const clone = node.cloneNode(true);
      clone.setAttribute('data-inject', attrKey);
      container.appendChild(clone);
    }
  });
}

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch { /* use defaults */ }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  // Browser tab title
  useEffect(() => {
    if (settings.meta_title) document.title = settings.meta_title;
  }, [settings.meta_title]);

  // Google Analytics injection
  useEffect(() => {
    const gaId = settings.ga_tracking_id?.trim();
    document.querySelectorAll('[data-inject="ga"]').forEach((el) => el.remove());
    if (!gaId) return;

    const s1 = document.createElement('script');
    s1.async = true;
    s1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    s1.setAttribute('data-inject', 'ga');
    document.head.appendChild(s1);

    const s2 = document.createElement('script');
    s2.setAttribute('data-inject', 'ga');
    s2.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
    document.head.appendChild(s2);
  }, [settings.ga_tracking_id]);

  // Custom <head> code
  useEffect(() => {
    injectHtml(settings.custom_head_code, document.head, 'custom-head');
  }, [settings.custom_head_code]);

  // Custom <body> code
  useEffect(() => {
    injectHtml(settings.custom_body_code, document.body, 'custom-body');
  }, [settings.custom_body_code]);

  const updateSettings = async (patch, token) => {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to save settings');
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, updateSettings, refetch: fetchSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
