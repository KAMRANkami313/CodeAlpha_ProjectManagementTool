import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, setTokenAccessors, TOKEN_STORAGE_KEYS } from '../services/api';
import { disconnectSocket } from '../services/socket';

export const AuthContext = createContext();

const USER_KEY = 'user';

const readStoredUser = () => {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const clearStoredSession = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEYS.access);
  localStorage.removeItem(TOKEN_STORAGE_KEYS.refresh);
  localStorage.removeItem(USER_KEY);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [initializing, setInitializing] = useState(() => Boolean(readStoredUser()));
  const initializedRef = useRef(false);

  const getAccessToken = useCallback(
    () => localStorage.getItem(TOKEN_STORAGE_KEYS.access),
    []
  );
  const getRefreshToken = useCallback(
    () => localStorage.getItem(TOKEN_STORAGE_KEYS.refresh),
    []
  );

  const onTokensRefreshed = useCallback((data) => {
    if (data?.accessToken) localStorage.setItem(TOKEN_STORAGE_KEYS.access, data.accessToken);
    if (data?.refreshToken) localStorage.setItem(TOKEN_STORAGE_KEYS.refresh, data.refreshToken);
  }, []);

  useEffect(() => {
    setTokenAccessors({
      getAccess: getAccessToken,
      getRefresh: getRefreshToken,
      onRefreshed: onTokensRefreshed,
    });
  }, [getAccessToken, getRefreshToken, onTokensRefreshed]);

  const persistSession = (data) => {
    const sessionUser = { _id: data._id, name: data.name, email: data.email };
    localStorage.setItem(TOKEN_STORAGE_KEYS.access, data.accessToken);
    localStorage.setItem(TOKEN_STORAGE_KEYS.refresh, data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
  };

  const login = async (email, password) => {
    const data = await api.post('/users/login', { email, password });
    persistSession(data);
  };

  const register = async (name, email, password) => {
    const data = await api.post('/users', { name, email, password });
    persistSession(data);
  };

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(TOKEN_STORAGE_KEYS.refresh);
    if (refreshToken) {
      try {
        await api.post('/users/logout', { refreshToken });
      } catch {}
    }
    clearStoredSession();
    disconnectSocket();
    setUser(null);
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api.post('/users/logout-all', {});
    } catch {}
    clearStoredSession();
    disconnectSocket();
    setUser(null);
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const validateSession = async () => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEYS.access);
      if (!token) {
        setInitializing(false);
        return;
      }

      try {
        await api.get('/users/profile');
      } catch {
        clearStoredSession();
        setUser(null);
      } finally {
        setInitializing(false);
      }
    };

    validateSession();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredSession();
      disconnectSocket();
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, initializing, login, register, logout, logoutAll }}
    >
      {children}
    </AuthContext.Provider>
  );
};
