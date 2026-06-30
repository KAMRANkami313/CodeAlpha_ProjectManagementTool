import { useState, useEffect, useRef } from 'react';
import { X, Send, Pencil } from 'lucide-react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import useModal from '../hooks/useModal';

const TaskCommentsModal = ({ task, currentUser, onClose, onEdit }) => {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const socket = useSocket();
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useModal(true, onClose, containerRef);

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

    socket.on('comment:created', handleNewComment);
    return () => socket.off('comment:created', handleNewComment);
  }, [socket, task._id]);

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

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

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
          <h3 className="modal-title" id="comments-modal-title">{task.title}</h3>
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
          <span className="priority-badge">{task.priority}</span>
          <span>{task.status}</span>
          {task.assignedTo && <span>Assigned to {task.assignedTo.name}</span>}
        </div>

        {task.description && <p className="task-detail-description">{task.description}</p>}

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
