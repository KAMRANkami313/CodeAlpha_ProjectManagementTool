import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

const TYPING_TIMEOUT_MS = 3000;
const EMIT_THROTTLE_MS = 1000;

const useTypingIndicator = ({ taskId, projectId, currentUserId }) => {
  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState({});
  const lastEmitRef = useRef(0);
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleTyping = ({ taskId: incomingTaskId, userId, userName }) => {
      if (incomingTaskId !== taskId) return;
      if (String(userId) === String(currentUserId)) return;
      setTypingUsers((prev) => ({
        ...prev,
        [userId]: { name: userName, ts: Date.now() },
      }));
    };

    const handleStopTyping = ({ taskId: incomingTaskId, userId }) => {
      if (incomingTaskId !== taskId) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    socket.on('comment:typing', handleTyping);
    socket.on('comment:stopTyping', handleStopTyping);

    return () => {
      socket.off('comment:typing', handleTyping);
      socket.off('comment:stopTyping', handleStopTyping);
    };
  }, [socket, taskId, currentUserId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next = {};
        for (const [id, info] of Object.entries(prev)) {
          if (now - info.ts < TYPING_TIMEOUT_MS) {
            next[id] = info;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const startTyping = useCallback(() => {
    if (!socket || !taskId || !projectId) return;
    const now = Date.now();
    if (now - lastEmitRef.current < EMIT_THROTTLE_MS) return;
    lastEmitRef.current = now;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('comment:typing', { taskId, projectId });
    }

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        socket.emit('comment:stopTyping', { taskId, projectId });
      }
    }, TYPING_TIMEOUT_MS);
  }, [socket, taskId, projectId]);

  const stopTyping = useCallback(() => {
    if (!socket || !taskId || !projectId) return;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('comment:stopTyping', { taskId, projectId });
    }
  }, [socket, taskId, projectId]);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  const activeTypingUsers = Object.values(typingUsers);
  const isAnyoneTyping = activeTypingUsers.length > 0;

  const typingText = (() => {
    if (!isAnyoneTyping) return '';
    const names = activeTypingUsers.map((u) => u.name);
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing…`;
    return `${names.length} people are typing…`;
  })();

  return { typingUsers: activeTypingUsers, isAnyoneTyping, typingText, startTyping, stopTyping };
};

export default useTypingIndicator;