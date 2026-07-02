import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Send, Pencil, Check, Clock, AlertCircle, AtSign } from 'lucide-react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import useModal from '../hooks/useModal';
import useTypingIndicator from '../hooks/useTypingIndicator';
import useMentions from '../hooks/useMentions';
import Avatar from './Avatar';

const renderCommentContent = (content, members) => {
  if (!content) return null;
  if (!members?.length) return content;

  const escaped = content.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let html = escaped;

  for (const m of members) {
    const nameEscaped = m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameHtmlEscaped = m.name.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const regex = new RegExp(`@(${nameEscaped})`, 'g');
    html = html.replace(regex, `<span class="mention" data-user-id="${m._id}">@${nameHtmlEscaped}</span>`);
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

const TaskCommentsModal = ({ task, projectId, members, currentUser, onClose, onEdit, onTaskUpdated }) => {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [localTask, setLocalTask] = useState(task);
  const { socket } = useSocket();
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const { isAnyoneTyping, typingText, startTyping, stopTyping } = useTypingIndicator({
    taskId: task._id,
    projectId,
    currentUserId: currentUser?._id,
  });

  const {
    isMentioning,
    suggestions,
    selectedIndex,
    detectMention,
    clearMention,
    applyMention,
    moveSelection,
  } = useMentions({ members, currentUser });

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
      stopTyping();
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
  }, [socket, task._id, onTaskUpdated, stopTyping]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  useEffect(() => {
    if (!isAnyoneTyping) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isAnyoneTyping, typingText]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setContent(value);
    detectMention(value, e.target.selectionStart);
    if (value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const handleKeyDown = (e) => {
    if (isMentioning && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection('down');
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection('up');
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = suggestions[selectedIndex];
        if (selected) {
          const newValue = applyMention(inputRef, selected);
          setContent(newValue);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        clearMention();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (member) => {
    const newValue = applyMention(inputRef, member);
    setContent(newValue);
  };

  const handleSend = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    setError('');
    stopTyping();
    try {
      const newComment = await api.post(`/tasks/${task._id}/comments`, { content });
      setComments((prev) =>
        prev.some((c) => c._id === newComment._id) ? prev : [...prev, newComment]
      );
      setContent('');
      clearMention();
    } catch (err) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
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

  const renderedMembers = useMemo(() => members || [], [members]);

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
                <Avatar src={comment.user.avatar} name={comment.user.name} size="sm" className="comment-avatar" />
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
                  <p>{renderCommentContent(comment.content, renderedMembers)}</p>
                </div>
              </div>
            ))
          )}
          {isAnyoneTyping && (
            <div className="typing-indicator" aria-live="polite">
              <span className="typing-dots">
                <span /> <span /> <span />
              </span>
              <span className="typing-text">{typingText}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <div className="auth-error modal-error-inline">{error}</div>}

        <form className="comment-input-row" onSubmit={handleSubmit}>
          <div className="comment-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              placeholder="Write a comment… (use @ to mention)"
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={sending}
              aria-label="Write a comment"
            />
            {isMentioning && suggestions.length > 0 && (
              <div className="mention-suggestions" role="listbox" aria-label="Mention suggestions">
                {suggestions.map((m, idx) => (
                  <button
                    key={m._id}
                    type="button"
                    className={`mention-suggestion ${idx === selectedIndex ? 'mention-suggestion-active' : ''}`}
                    onClick={() => handleSuggestionClick(m)}
                    role="option"
                    aria-selected={idx === selectedIndex}
                  >
                    <Avatar src={m.avatar} name={m.name} size="xs" />
                    <span className="mention-suggestion-name">{m.name}</span>
                    <span className="mention-suggestion-email">{m.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="submit" className="auth-btn comment-send-btn" disabled={sending || !content.trim()}>
            <Send size={16} />
          </button>
        </form>

        <div className="comment-input-hint">
          <AtSign size={11} />
          <span>Type @ to mention a project member · Press Enter to send · Shift+Enter for newline</span>
        </div>
      </div>
    </div>
  );
};

export default TaskCommentsModal;