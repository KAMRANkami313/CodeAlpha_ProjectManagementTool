import { useState, useRef } from 'react';
import { X, Trash2, Archive, ArchiveRestore, Plus, Check } from 'lucide-react';
import { api } from '../services/api';
import useModal from '../hooks/useModal';

const STATUSES = ['Todo', 'In Progress', 'In Review', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High'];

const DEFAULT_LABEL_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#64748b',
];

const TaskModal = ({ projectId, members, task, defaultStatus, onClose, onSaved, onDeleted }) => {
  const isEditing = Boolean(task);

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || defaultStatus || 'Todo');
  const [priority, setPriority] = useState(task?.priority || 'Medium');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo?._id || '');
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : '');
  const [labels, setLabels] = useState(task?.labels || []);
  const [subtasks, setSubtasks] = useState(task?.subtasks || []);
  const [newSubtask, setNewSubtask] = useState('');
  const [timeEstimateMinutes, setTimeEstimateMinutes] = useState(
    task?.timeEstimateMinutes ? String(task.timeEstimateMinutes) : ''
  );
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(
    task?.timeSpentMinutes ? String(task.timeSpentMinutes) : ''
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const containerRef = useRef(null);

  useModal(true, onClose, containerRef);

  const addLabel = () => {
    setLabels((prev) => [
      ...prev,
      { name: '', color: DEFAULT_LABEL_COLORS[prev.length % DEFAULT_LABEL_COLORS.length] },
    ]);
  };

  const updateLabel = (idx, field, value) => {
    setLabels((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  const removeLabel = (idx) => {
    setLabels((prev) => prev.filter((_, i) => i !== idx));
  };

  const addSubtaskLocal = () => {
    if (!newSubtask.trim()) return;
    setSubtasks((prev) => [...prev, { _id: crypto.randomUUID(), title: newSubtask.trim(), done: false, _temp: true }]);
    setNewSubtask('');
  };

  const updateSubtaskLocal = (id, title) => {
    setSubtasks((prev) => prev.map((s) => (s._id === id ? { ...s, title } : s)));
  };

  const toggleSubtaskLocal = (id) => {
    setSubtasks((prev) => prev.map((s) => (s._id === id ? { ...s, done: !s.done } : s)));
  };

  const removeSubtaskLocal = (id) => {
    setSubtasks((prev) => prev.filter((s) => s._id !== id));
  };

  const buildPayload = () => {
    const payload = {
      title,
      description,
      status,
      priority,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
      labels: labels.filter((l) => l.name.trim()),
      timeEstimateMinutes: timeEstimateMinutes ? Number(timeEstimateMinutes) : null,
    };
    if (isEditing) {
      payload.timeSpentMinutes = timeSpentMinutes ? Number(timeSpentMinutes) : 0;
    }
    if (!isEditing && subtasks.length > 0) {
      payload.subtasks = subtasks.map((s) => ({ title: s.title, done: s.done }));
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let saved;
      if (isEditing) {
        saved = await api.put(`/tasks/${task._id}`, buildPayload());

        const existingSubtaskIds = new Set(
          (task.subtasks || []).map((s) => s._id?.toString?.() || s._id)
        );
        for (const sub of subtasks) {
          const subId = sub._id?.toString?.() || sub._id;
          if (sub._temp || !existingSubtaskIds.has(subId)) {
            await api.post(`/tasks/${task._id}/subtasks`, { title: sub.title });
          } else {
            const original = task.subtasks.find((s) => (s._id?.toString?.() || s._id) === subId);
            if (original && (original.title !== sub.title || original.done !== sub.done)) {
              if (original.done !== sub.done) {
                await api.patch(`/tasks/${task._id}/subtasks/${subId}`, { done: sub.done });
              }
              if (original.title !== sub.title) {
                await api.put(`/tasks/${task._id}/subtasks/${subId}`, { title: sub.title });
              }
            }
          }
        }

        for (const original of task.subtasks || []) {
          const origId = original._id?.toString?.() || original._id;
          if (!subtasks.some((s) => (s._id?.toString?.() || s._id) === origId)) {
            await api.delete(`/tasks/${task._id}/subtasks/${origId}`);
          }
        }

        saved = await api.get(`/tasks/${task._id}`);
      } else {
        saved = await api.post('/tasks', { ...buildPayload(), project: projectId });
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

  const handleArchiveToggle = async () => {
    setArchiving(true);
    setError('');
    try {
      const endpoint = task.isArchived ? 'unarchive' : 'archive';
      const updated = await api.put(`/tasks/${task._id}/${endpoint}`, {});
      onSaved(updated);
    } catch (err) {
      setError(err.message || 'Failed to toggle archive');
    } finally {
      setArchiving(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={handleOverlayClick}>
      <div
        className="modal-container task-modal-wide"
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
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="taskPriority">Priority</label>
              <select id="taskPriority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
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
                  <option key={m._id} value={m._id}>{m.name}</option>
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

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="taskEstimate">Time Estimate (min)</label>
              <input
                id="taskEstimate"
                type="number"
                min="0"
                value={timeEstimateMinutes}
                onChange={(e) => setTimeEstimateMinutes(e.target.value)}
                placeholder="e.g. 120"
              />
            </div>
            {isEditing && (
              <div className="form-group">
                <label htmlFor="taskSpent">Time Spent (min)</label>
                <input
                  id="taskSpent"
                  type="number"
                  min="0"
                  value={timeSpentMinutes}
                  onChange={(e) => setTimeSpentMinutes(e.target.value)}
                  placeholder="e.g. 45"
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <div className="label-row">
              <label>Labels</label>
              <button type="button" className="link-btn" onClick={addLabel}>
                <Plus size={14} /> Add
              </button>
            </div>
            <div className="labels-editor">
              {labels.length === 0 && (
                <span className="labels-empty">No labels yet</span>
              )}
              {labels.map((label, idx) => (
                <div className="label-editor-row" key={idx}>
                  <input
                    type="color"
                    value={label.color}
                    onChange={(e) => updateLabel(idx, 'color', e.target.value)}
                    className="label-color-input"
                    aria-label={`Label ${idx + 1} color`}
                  />
                  <input
                    type="text"
                    value={label.name}
                    onChange={(e) => updateLabel(idx, 'name', e.target.value)}
                    placeholder="Label name"
                    maxLength={30}
                  />
                  <button
                    type="button"
                    className="icon-btn-danger"
                    onClick={() => removeLabel(idx)}
                    aria-label="Remove label"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label>Subtasks {subtasks.length > 0 && `(${subtasks.filter((s) => s.done).length}/${subtasks.length})`}</label>
            </div>
            <div className="subtasks-editor">
              {subtasks.map((sub) => (
                <div className="subtask-row" key={sub._id}>
                  <button
                    type="button"
                    className={`subtask-check ${sub.done ? 'subtask-checked' : ''}`}
                    onClick={() => toggleSubtaskLocal(sub._id)}
                    aria-label={sub.done ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {sub.done && <Check size={12} />}
                  </button>
                  <input
                    type="text"
                    value={sub.title}
                    onChange={(e) => updateSubtaskLocal(sub._id, e.target.value)}
                    className={sub.done ? 'subtask-title-done' : ''}
                  />
                  <button
                    type="button"
                    className="icon-btn-danger"
                    onClick={() => removeSubtaskLocal(sub._id)}
                    aria-label="Remove subtask"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <div className="subtask-add-row">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSubtaskLocal();
                    }
                  }}
                  placeholder="Add a subtask…"
                />
                <button type="button" className="btn-secondary" onClick={addSubtaskLocal}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className={`modal-footer ${isEditing ? 'modal-footer-edit' : ''}`}>
            {isEditing && (
              <>
                <button
                  type="button"
                  className="btn-danger-ghost"
                  onClick={handleDelete}
                  disabled={saving || archiving}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
                <button
                  type="button"
                  className="btn-secondary-ghost"
                  onClick={handleArchiveToggle}
                  disabled={saving || archiving}
                >
                  {task.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  {task.isArchived ? 'Unarchive' : 'Archive'}
                </button>
              </>
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