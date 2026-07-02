import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { api } from '../services/api';

export const PreferencesContext = createContext(null);

const THEME_STORAGE_KEY = 'collabtask-theme';

const getSystemPrefersLight = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: light)').matches;

const resolveTheme = (preference) => {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return getSystemPrefersLight() ? 'light' : 'dark';
};

const applyThemeToDom = (resolved) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
};

const readStoredTheme = () => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
  } catch {
    return 'system';
  }
};

export const PreferencesProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [themePreference, setThemePreference] = useState(readStoredTheme);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [compactView, setCompactView] = useState(false);

  const resolvedTheme = resolveTheme(themePreference);

  useEffect(() => {
    applyThemeToDom(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (themePreference !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyThemeToDom(getSystemPrefersLight() ? 'light' : 'dark');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [themePreference]);

  useEffect(() => {
    if (!user) {
      setThemePreference(readStoredTheme());
      setEmailNotifications(true);
      setCompactView(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        const profile = await api.get('/users/profile');
        if (profile.preferences?.theme) {
          setThemePreference(profile.preferences.theme);
          localStorage.setItem(THEME_STORAGE_KEY, profile.preferences.theme);
        }
        if (typeof profile.preferences?.emailNotifications === 'boolean') {
          setEmailNotifications(profile.preferences.emailNotifications);
        }
        if (typeof profile.preferences?.compactView === 'boolean') {
          setCompactView(profile.preferences.compactView);
        }
      } catch {}
    };
    loadPreferences();
  }, [user]);

  const updateTheme = useCallback(async (newTheme) => {
    setThemePreference(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyThemeToDom(resolveTheme(newTheme));
    try {
      await api.put('/users/profile', { preferences: { theme: newTheme } });
    } catch {}
  }, []);

  const updateEmailNotifications = useCallback(async (enabled) => {
    setEmailNotifications(enabled);
    try {
      await api.put('/users/profile', { preferences: { emailNotifications: enabled } });
    } catch {}
  }, []);

  const updateCompactView = useCallback(async (enabled) => {
    setCompactView(enabled);
    try {
      await api.put('/users/profile', { preferences: { compactView: enabled } });
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    const current = resolveTheme(themePreference);
    const next = current === 'dark' ? 'light' : 'dark';
    updateTheme(next);
  }, [themePreference, updateTheme]);

  return (
    <PreferencesContext.Provider
      value={{
        themePreference,
        resolvedTheme,
        emailNotifications,
        compactView,
        updateTheme,
        toggleTheme,
        updateEmailNotifications,
        updateCompactView,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => useContext(PreferencesContext);