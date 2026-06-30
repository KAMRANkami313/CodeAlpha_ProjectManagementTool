import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

/**
 * Socket connections authenticate with the same JWT used for REST calls
 * (sent as `auth.token` from the client). On connect, the socket auto-joins
 * a private room scoped to the user (`user:<id>`) so the server can push
 * notifications directly to them, and clients explicitly join/leave
 * `project:<id>` rooms when they open/close a board.
 *
 * Note: clients only ever JOIN rooms here. They never emit domain events
 * (taskCreated, commentCreated, etc.) - those are emitted exclusively by the
 * backend controllers after a DB write succeeds, so the UI can't be spoofed
 * by a malicious client broadcasting fake updates.
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on('project:join', (projectId) => {
      if (projectId) socket.join(`project:${projectId}`);
    });

    socket.on('project:leave', (projectId) => {
      if (projectId) socket.leave(`project:${projectId}`);
    });

    socket.on('disconnect', () => {});
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export { initSocket, getIO };
