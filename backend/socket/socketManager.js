import { Server } from 'socket.io';

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('joinProject', (projectId) => {
      socket.join(projectId);
    });

    socket.on('leaveProject', (projectId) => {
      socket.leave(projectId);
    });

    socket.on('taskCreated', (data) => {
      socket.to(data.project).emit('taskCreated', data);
    });

    socket.on('taskUpdated', (data) => {
      socket.to(data.project).emit('taskUpdated', data);
    });

    socket.on('taskDeleted', (data) => {
      socket.to(data.project).emit('taskDeleted', data);
    });

    socket.on('commentCreated', (data) => {
      socket.to(data.project).emit('commentCreated', data);
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