import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

/**
 * Joins the given project's real-time room while the component using this
 * hook is mounted, and leaves it on unmount/project change.
 */
const useProjectRoom = (projectId) => {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !projectId) return;

    socket.emit('project:join', projectId);

    return () => {
      socket.emit('project:leave', projectId);
    };
  }, [socket, projectId]);
};

export default useProjectRoom;
