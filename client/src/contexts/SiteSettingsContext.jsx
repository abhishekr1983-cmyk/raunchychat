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
};

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

  useEffect(() => {
    fetchSettings();
  }, []);

  // Update browser tab title when meta_title changes
  useEffect(() => {
    if (settings.meta_title) document.title = settings.meta_title;
  }, [settings.meta_title]);

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
