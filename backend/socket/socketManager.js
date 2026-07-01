import { Server } from 'socket.io';
import mongoose from 'mongoose';
import Project from '../models/Project.js';
import User from '../models/User.js';
import { verifyAccessToken } from '../utils/generateToken.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let io;

const isProjectMember = (userId, members) =>
  members.some((m) => m.toString() === userId.toString());

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyAccessToken(token);

      if (decoded.type !== 'access') {
        return next(new Error('Invalid token type'));
      }

      const user = await User.findById(decoded.userId).select('tokenVersion name email');

      if (!user) {
        return next(new Error('User no longer exists'));
      }

      if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
        return next(new Error('Session invalidated'));
      }

      socket.userId = decoded.userId;
      socket.tokenVersion = decoded.tokenVersion;
      socket.user = user;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('Access token expired'));
      }
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);

    logger.info({ userId: socket.userId }, 'Socket connected');

    socket.on('project:join', async (projectId) => {
      try {
        if (!projectId || !mongoose.isValidObjectId(projectId)) return;

        const project = await Project.findById(projectId).select('members');
        if (!project || !isProjectMember(socket.userId, project.members)) {
          return;
        }

        socket.join(`project:${projectId}`);
      } catch (err) {
        socket.emit('error', 'Failed to join project room');
      }
    });

    socket.on('project:leave', (projectId) => {
      if (projectId) socket.leave(`project:${projectId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info({ userId: socket.userId, reason }, 'Socket disconnected');
    });
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
