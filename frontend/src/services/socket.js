import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

const getSocket = (token) => {
  if (socket) {
    if (socket.connected) return socket;
    socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: { token },
    withCredentials: true,
  });

  socket.connect();
  return socket;
};

const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export { getSocket, disconnectSocket };
