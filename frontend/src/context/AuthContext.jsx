import { createContext, useState, useEffect, useCallback } from 'react';
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
  const [loading, setLoading] = useState(false);

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

  // If any API call comes back 401, the session is no longer valid - log out.
  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
