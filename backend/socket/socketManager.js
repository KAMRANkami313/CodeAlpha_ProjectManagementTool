import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Project from '../models/Project.js';

let io;

const isProjectMember = (projectId, members) =>
  members.some((m) => m.toString() === projectId);

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
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
