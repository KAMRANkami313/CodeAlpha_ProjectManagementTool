import { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { getSocket, disconnectSocket } from '../services/socket';
import { TOKEN_STORAGE_KEYS } from '../services/api';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const tokenGetter = () => localStorage.getItem(TOKEN_STORAGE_KEYS.access);
    const instance = getSocket(tokenGetter);
    setSocket(instance);
    setIsConnected(instance.connected);

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    instance.on('connect', handleConnect);
    instance.on('disconnect', handleDisconnect);

    return () => {
      instance.off('connect', handleConnect);
      instance.off('disconnect', handleDisconnect);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
