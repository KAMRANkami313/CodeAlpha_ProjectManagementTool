import { getIO } from '../socket/socketManager.js';

/**
 * Broadcasts an event to everyone in a project's room (except optionally the actor,
 * who already has the optimistic result from the HTTP response).
 */
const broadcastToProject = (projectId, event, payload) => {
  try {
    getIO().to(`project:${projectId.toString()}`).emit(event, payload);
  } catch (err) {
    // Socket.io not initialized (e.g. during tests) - safe to ignore.
  }
};

export { broadcastToProject };
