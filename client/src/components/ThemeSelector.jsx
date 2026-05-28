import { useEffect, useRef, useState } from 'react';
import { useTheme, THEMES } from '../contexts/ThemeContext';

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="theme-selector" ref={ref}>
      <button
        className="theme-trigger"
        onClick={() => setOpen((o) => !o)}
        title="Change theme"
      >
        <span className="theme-trigger-swatch" style={{ background: THEMES[theme].swatch }} />
        <span>Theme</span>
        <span className="theme-trigger-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="theme-dropdown">
          <div className="theme-dropdown-title">Choose a vibe</div>
          {Object.entries(THEMES).map(([key, { name, emoji, swatch, desc }]) => (
            <button
              key={key}
              className={`theme-option ${theme === key ? 'active' : ''}`}
              onClick={() => { setTheme(key); setOpen(false); }}
            >
              <span className="theme-option-swatch" style={{ background: swatch }} />
              <span className="theme-option-info">
                <span className="theme-option-name">{emoji} {name}</span>
                <span className="theme-option-desc">{desc}</span>
              </span>
              {theme === key && <span className="theme-option-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
