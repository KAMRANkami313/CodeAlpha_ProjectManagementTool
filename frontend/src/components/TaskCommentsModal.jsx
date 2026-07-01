import { useState, useEffect, useRef } from 'react';
import { X, Send, Pencil, Check, Clock, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import useModal from '../hooks/useModal';

const TaskCommentsModal = ({ task, currentUser, onClose, onEdit, onTaskUpdated }) => {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [localTask, setLocalTask] = useState(task);
  const { socket } = useSocket();
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useModal(true, onClose, containerRef);

  useEffect(() => {
    setLocalTask(task);
  }, [task]);

  useEffect(() => {
    let active = true;
    const loadComments = async () => {
      try {
        const data = await api.get(`/tasks/${task._id}/comments`);
        if (active) setComments(data);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load comments');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadComments();
    return () => {
      active = false;
    };
  }, [task._id]);

  useEffect(() => {
    if (!socket) return;

    const handleNewComment = (payload) => {
      if (payload.taskId !== task._id) return;
      setComments((prev) =>
        prev.some((c) => c._id === payload.comment._id) ? prev : [...prev, payload.comment]
      );
    };

    const handleTaskUpdated = (updated) => {
      if (updated._id === task._id) {
        setLocalTask(updated);
        if (onTaskUpdated) onTaskUpdated(updated);
      }
    };

    socket.on('comment:created', handleNewComment);
    socket.on('task:updated', handleTaskUpdated);
    return () => {
      socket.off('comment:created', handleNewComment);
      socket.off('task:updated', handleTaskUpdated);
    };
  }, [socket, task._id, onTaskUpdated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    setError('');
    try {
      const newComment = await api.post(`/tasks/${task._id}/comments`, { content });
      setComments((prev) =>
        prev.some((c) => c._id === newComment._id) ? prev : [...prev, newComment]
      );
      setContent('');
    } catch (err) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  const handleToggleSubtask = async (subtaskId, currentDone) => {
    try {
      const updated = await api.patch(
        `/tasks/${task._id}/subtasks/${subtaskId}`,
        { done: !currentDone }
      );
      setLocalTask(updated);
      if (onTaskUpdated) onTaskUpdated(updated);
    } catch (err) {
      setError(err.message || 'Failed to toggle subtask');
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const subtaskTotal = localTask.subtasks?.length || 0;
  const subtaskDone = localTask.subtasks?.filter((s) => s.done).length || 0;
  const isOverdue = localTask.dueDate && localTask.status !== 'Done' && new Date(localTask.dueDate) < new Date();

  return (
    <div className="modal-overlay animate-fade-in" onClick={handleOverlayClick}>
      <div
        className="modal-container comments-modal"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comments-modal-title"
      >
        <div className="modal-header">
          <h3 className="modal-title" id="comments-modal-title">{localTask.title}</h3>
          <div className="modal-header-actions">
            <button className="modal-close" onClick={onEdit} title="Edit task" aria-label="Edit task">
              <Pencil size={18} />
            </button>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="task-detail-meta">
          <span className={`priority-badge priority-${localTask.priority?.toLowerCase()}`}>
            {localTask.priority}
          </span>
          <span>{localTask.status}</span>
          {localTask.assignedTo && <span>Assigned to {localTask.assignedTo.name}</span>}
          {localTask.dueDate && (
            <span className={isOverdue ? 'task-due-overdue-text' : ''}>
              <Clock size={12} />
              {new Date(localTask.dueDate).toLocaleDateString()}
              {isOverdue && <AlertCircle size={12} />}
            </span>
          )}
          {localTask.timeEstimateMinutes && (
            <span><Clock size={12} /> Est: {localTask.timeEstimateMinutes}m</span>
          )}
          {localTask.timeSpentMinutes > 0 && (
            <span>Spent: {localTask.timeSpentMinutes}m</span>
          )}
        </div>

        {localTask.labels?.length > 0 && (
          <div className="task-detail-labels">
            {localTask.labels.map((label, idx) => (
              <span
                key={idx}
                className="task-label-chip"
                style={{
                  backgroundColor: `${label.color}22`,
                  color: label.color,
                  borderColor: `${label.color}55`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {localTask.description && <p className="task-detail-description">{localTask.description}</p>}

        {subtaskTotal > 0 && (
          <div className="task-detail-subtasks">
            <div className="task-detail-subtasks-header">
              Subtasks ({subtaskDone}/{subtaskTotal})
            </div>
            {localTask.subtasks.map((sub) => (
              <div key={sub._id} className="task-detail-subtask-row">
                <button
                  className={`subtask-check ${sub.done ? 'subtask-checked' : ''}`}
                  onClick={() => handleToggleSubtask(sub._id, sub.done)}
                  aria-label={sub.done ? 'Mark incomplete' : 'Mark complete'}
                >
                  {sub.done && <Check size={12} />}
                </button>
                <span className={sub.done ? 'subtask-title-done' : ''}>{sub.title}</span>
              </div>
            ))}
          </div>
        )}

        <div className="comments-thread">
          {loading ? (
            <div className="comments-empty">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="comments-empty">No comments yet. Start the discussion.</div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment._id}
                className={`comment-item ${comment.user._id === currentUser?._id ? 'comment-own' : ''}`}
              >
                <div className="comment-avatar">{comment.user.name.charAt(0).toUpperCase()}</div>
                <div className="comment-bubble">
                  <div className="comment-meta">
                    <span className="comment-author">{comment.user.name}</span>
                    <span className="comment-time">
                      {new Date(comment.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p>{comment.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {error && <div className="auth-error modal-error-inline">{error}</div>}

        <form className="comment-input-row" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Write a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={sending}
          />
          <button type="submit" className="auth-btn comment-send-btn" disabled={sending || !content.trim()}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default TaskCommentsModal;