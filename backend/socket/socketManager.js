import { Server } from 'socket.io';
import mongoose from 'mongoose';
import Project from '../models/Project.js';
import User from '../models/User.js';
import { verifyAccessToken } from '../utils/generateToken.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let io;

const PRESENCE_BROADCAST_DEBOUNCE_MS = 5000;
const recentPresenceBroadcasts = new Map();

const isProjectMember = (userId, members) =>
  members.some((m) => m.toString() === userId.toString());

const broadcastPresenceToProjects = async (userId, isOnline) => {
  const now = Date.now();
  const lastBroadcast = recentPresenceBroadcasts.get(String(userId));
  if (lastBroadcast && now - lastBroadcast < PRESENCE_BROADCAST_DEBOUNCE_MS) {
    return;
  }
  recentPresenceBroadcasts.set(String(userId), now);

  try {
    const projects = await Project.find({ members: userId }).select('_id');
    const payload = { userId: String(userId), isOnline, lastSeenAt: new Date().toISOString() };
    projects.forEach((p) => {
      io.to(`project:${p._id}`).emit('presence:update', payload);
    });
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to broadcast presence');
  }
};

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

      const user = await User.findById(decoded.userId).select('tokenVersion name email lastSeenAt');

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

  io.on('connection', async (socket) => {
    socket.join(`user:${socket.userId}`);

    try {
      socket.user.lastSeenAt = new Date();
      await socket.user.save();
      await broadcastPresenceToProjects(socket.userId, true);
    } catch (err) {
      logger.warn({ err, userId: socket.userId }, 'Failed to touch presence on connect');
    }

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

    socket.on('presence:ping', async () => {
      try {
        socket.user.lastSeenAt = new Date();
        await socket.user.save();
      } catch (err) {
        logger.warn({ err, userId: socket.userId }, 'Failed to touch presence on ping');
      }
    });

    socket.on('disconnect', async (reason) => {
      logger.info({ userId: socket.userId, reason }, 'Socket disconnected');
      setTimeout(async () => {
        const stillConnected = await io.to(`user:${socket.userId}`).fetchSockets();
        if (stillConnected.length === 0) {
          try {
            await User.updateOne(
              { _id: socket.userId },
              { $set: { lastSeenAt: new Date() } }
            );
            await broadcastPresenceToProjects(socket.userId, false);
          } catch (err) {
            logger.warn({ err, userId: socket.userId }, 'Failed to update presence on disconnect');
          }
        }
      }, 5000);
    });
  });

  setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of recentPresenceBroadcasts) {
      if (value < cutoff) recentPresenceBroadcasts.delete(key);
    }
  }, 10 * 60 * 1000);

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export { initSocket, getIO };