import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'light' | 'sepia' | 'dark';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  isThemeModalOpen: boolean;
  setIsThemeModalOpen: (open: boolean) => void;
  openThemeModal: () => void;
  closeThemeModal: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_KEY = 'pena_app_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'sepia' || saved === 'dark') {
        return saved;
      }
    } catch {}
    return 'light';
  });

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}

    const el = document.documentElement;
    el.setAttribute('data-theme', theme);
    if (typeof document !== 'undefined' && document.body) {
      document.body.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        el.classList.add('dark');
        el.classList.remove('sepia');
        document.body.classList.add('dark');
        document.body.classList.remove('sepia');
      } else if (theme === 'sepia') {
        el.classList.add('sepia');
        el.classList.remove('dark');
        document.body.classList.add('sepia');
        document.body.classList.remove('dark');
      } else {
        el.classList.remove('dark', 'sepia');
        document.body.classList.remove('dark', 'sepia');
      }
    }
  }, [theme]);

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
  };

  const openThemeModal = () => setIsThemeModalOpen(true);
  const closeThemeModal = () => setIsThemeModalOpen(false);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isThemeModalOpen,
        setIsThemeModalOpen,
        openThemeModal,
        closeThemeModal
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return ctx;
};
