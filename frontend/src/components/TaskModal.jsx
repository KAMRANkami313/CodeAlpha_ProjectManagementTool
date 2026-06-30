import { useState, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import useModal from '../hooks/useModal';

const STATUSES = ['Todo', 'In Progress', 'In Review', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High'];

const TaskModal = ({ projectId, members, task, defaultStatus, onClose, onSaved, onDeleted }) => {
  const isEditing = Boolean(task);

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || defaultStatus || 'Todo');
  const [priority, setPriority] = useState(task?.priority || 'Medium');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo?._id || '');
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  useModal(true, onClose, containerRef);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      title,
      description,
      status,
      priority,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
    };

    try {
      let saved;
      if (isEditing) {
        saved = await api.put(`/tasks/${task._id}`, payload);
      } else {
        saved = await api.post('/tasks', { ...payload, project: projectId });
      }
      onSaved(saved);
    } catch (err) {
      setError(err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task? This also removes its comments.')) return;
    setSaving(true);
    try {
      await api.delete(`/tasks/${task._id}`);
      onDeleted(task._id);
    } catch (err) {
      setError(err.message || 'Failed to delete task');
      setSaving(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={handleOverlayClick}>
      <div
        className="modal-container"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <div className="modal-header">
          <h3 className="modal-title" id="task-modal-title">{isEditing ? 'Edit Task' : 'New Task'}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {error && <div className="auth-error modal-error-block">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="taskTitle">Title</label>
            <input
              id="taskTitle"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="taskDesc">Description</label>
            <textarea
              id="taskDesc"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="taskStatus">Status</label>
              <select id="taskStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="taskPriority">Priority</label>
              <select id="taskPriority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="taskAssignee">Assignee</label>
              <select
                id="taskAssignee"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="taskDueDate">Due Date</label>
              <input
                id="taskDueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className={`modal-footer ${isEditing ? 'modal-footer-edit' : ''}`}>
            {isEditing && (
              <button
                type="button"
                className="btn-danger-ghost"
                onClick={handleDelete}
                disabled={saving}
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <div className="modal-footer-actions">
              <button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button className="auth-btn modal-submit-btn" type="submit" disabled={saving}>
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
