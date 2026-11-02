import { createContext, useContext, useEffect, useState } from 'react';

// Light/dark theme. Follows the system setting until the user picks one with the header toggle.
const STORAGE_KEY = 'uwclubs.theme';
const ThemeContext = createContext(null);
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function readChoice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(readChoice);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);

  useEffect(() => {
    const query = darkQuery();
    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice) root.dataset.theme = choice;
    else delete root.dataset.theme;
    try {
      if (choice) localStorage.setItem(STORAGE_KEY, choice);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked; the choice just won't survive a reload.
    }
  }, [choice]);

  const theme = choice ?? (systemDark ? 'dark' : 'light');
  const value = {
    theme,
    toggle() {
      const next = theme === 'dark' ? 'light' : 'dark';
      // Picking the system's own theme goes back to following the system.
      setChoice(next === (systemDark ? 'dark' : 'light') ? null : next);
    },
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
