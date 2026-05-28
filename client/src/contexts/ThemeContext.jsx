import { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = {
  'dark-seduction': {
    name: 'Dark Seduction',
    emoji: '🖤',
    swatch: '#3b82f6',
    desc: 'Classic deep navy',
  },
  'red-hot': {
    name: 'Red Hot',
    emoji: '🔥',
    swatch: '#ef4444',
    desc: 'Burning crimson',
  },
  'velvet-night': {
    name: 'Velvet Night',
    emoji: '💜',
    swatch: '#a855f7',
    desc: 'Mysterious violet',
  },
  'neon-sin': {
    name: 'Neon Sin',
    emoji: '💗',
    swatch: '#ff0080',
    desc: 'Cyberpunk magenta',
  },
  'golden-desire': {
    name: 'Golden Desire',
    emoji: '✨',
    swatch: '#f59e0b',
    desc: 'Luxe dark gold',
  },
  'rose-bloom': {
    name: 'Rose Bloom',
    emoji: '🌹',
    swatch: '#ec4899',
    desc: 'Sensual rose',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('rc_theme') || 'dark-seduction'
  );

  const setTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('rc_theme', t);
    setThemeState(t);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
