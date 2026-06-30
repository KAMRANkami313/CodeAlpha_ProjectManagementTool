import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import { getSocket, disconnectSocket } from '../services/socket';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    const token = localStorage.getItem('token');
    const instance = getSocket(token);
    socketRef.current = instance;
    setSocket(instance);

    return () => {
      // Connection is intentionally kept alive across route changes within
      // a session; it's only torn down on logout (handled above) or unmount.
    };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
