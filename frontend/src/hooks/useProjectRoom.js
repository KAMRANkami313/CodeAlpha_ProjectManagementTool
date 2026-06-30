import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

const useProjectRoom = (projectId) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !projectId) return;

    socket.emit('project:join', projectId);

    return () => {
      socket.emit('project:leave', projectId);
    };
  }, [socket, projectId]);
};

export default useProjectRoom;
