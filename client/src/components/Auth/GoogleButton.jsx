/**
 * Reusable Google Sign-In button.
 * Loads the GIS script once (module-level singleton), initializes per-mount,
 * renders the official Google button into its own div.
 * Returns null silently if google_client_id is not configured.
 */
import { useEffect, useRef } from 'react';
import { useSiteSettings } from '../../contexts/SiteSettingsContext';
import { useAuth } from '../../contexts/AuthContext';

// Module-level: load GIS script only once across all instances
let _scriptPromise = null;
function loadGIS() {
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise((resolve) => {
    if (window.google?.accounts?.id) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => { _scriptPromise = null; resolve(); };
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

export default function GoogleButton({ width = 360, onError }) {
  const { settings } = useSiteSettings();
  const { login } = useAuth();
  const clientId = settings.google_client_id?.trim();
  const divRef = useRef(null);
  const callbackRef = useRef(null);

  // Keep callback fresh (avoids stale closure)
  callbackRef.current = async ({ credential }) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
      login(data.token, data.user);
    } catch (e) {
      onError?.(e.message || 'Google sign-in failed');
    }
  };

  useEffect(() => {
    if (!clientId || !divRef.current) return;
    let cancelled = false;

    loadGIS().then(() => {
      if (cancelled || !divRef.current || !window.google?.accounts?.id) return;
      // Initialize fresh (safe to call multiple times with same client_id)
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => callbackRef.current(resp),
      });
      window.google.accounts.id.renderButton(divRef.current, {
        theme: 'outline',
        size: 'large',
        width: Math.min(width, divRef.current.offsetWidth || width),
        text: 'continue_with',
        shape: 'rectangular',
      });
    });

    return () => { cancelled = true; };
  }, [clientId, width]);

  if (!clientId) return null;

  return <div ref={divRef} className="cb-google-btn" />;
}
