import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { disconnectSocket } from '../services/socket';

export const AuthContext = createContext();

const readStoredUser = () => {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [initializing, setInitializing] = useState(() => Boolean(readStoredUser()));
  const initializedRef = useRef(false);

  const persistSession = (data) => {
    const sessionUser = { _id: data._id, name: data.name, email: data.email };
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(sessionUser));
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

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
    setUser(null);
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const validateSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setInitializing(false);
        return;
      }

      try {
        await api.get('/users/profile');
      } catch {
        logout();
      } finally {
        setInitializing(false);
      }
    };

    validateSession();
  }, [logout]);

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, initializing, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
