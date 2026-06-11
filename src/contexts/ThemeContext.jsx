/**
 * Theme Context
 * Industry-level theme management with system preference detection
 * Supports light and dark themes with localStorage persistence
 * No code repetition - uses CSS variables for all theming
 */

import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Get system preference
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark'; // Default to dark if can't detect
  };

  // Initialize theme from localStorage or system preference
  const getInitialTheme = () => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
    }
    return getSystemTheme();
  };

  const [theme, setTheme] = useState(getInitialTheme);
  const [isSystemTheme, setIsSystemTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('theme');
    }
    return true;
  });

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    // Remove all theme classes first
    root.classList.remove('light-theme', 'dark-theme');
    body.classList.remove('light-theme', 'dark-theme');
    
    if (theme === 'dark') {
      root.classList.add('dark-theme');
      root.setAttribute('data-theme', 'dark');
      body.classList.add('dark-theme');
    } else {
      root.classList.add('light-theme');
      root.setAttribute('data-theme', 'light');
      body.classList.add('light-theme');
    }
  }, [theme]);

  // Listen to system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      if (isSystemTheme) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    } 
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemThemeChange);
      return () => mediaQuery.removeListener(handleSystemThemeChange);
    }
  }, [isSystemTheme]);

  // Toggle theme
  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      setIsSystemTheme(false);
      return newTheme;
    });
  };

  // Set theme explicitly
  const setThemeMode = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
      setIsSystemTheme(false);
    }
  };

  // Reset to system theme
  const resetToSystemTheme = () => {
    const systemTheme = getSystemTheme();
    setTheme(systemTheme);
    localStorage.removeItem('theme');
    setIsSystemTheme(true);
  };

  const value = {
    theme,
    isSystemTheme,
    toggleTheme,
    setThemeMode,
    resetToSystemTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

