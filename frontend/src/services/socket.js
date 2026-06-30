import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/**
 * Lazily creates (or reuses) a single authenticated socket connection for
 * the lifetime of a logged-in session. Call disconnectSocket() on logout.
 */
const getSocket = (token) => {
  if (socket && socket.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token },
      withCredentials: true,
    });
  } else {
    socket.auth = { token };
  }

  socket.connect();
  return socket;
};

const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export { getSocket, disconnectSocket };
