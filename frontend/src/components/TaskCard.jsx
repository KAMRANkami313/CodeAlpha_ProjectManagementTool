import { Calendar, User, CheckSquare, AlertCircle, Archive } from 'lucide-react';

const priorityClass = {
  Low: 'priority-low',
  Medium: 'priority-medium',
  High: 'priority-high',
};

const formatDate = (dateStr) => {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return '';
  }
};

const TaskCard = ({ task, onClick, onDragStart }) => {
  const subtaskTotal = task.subtasks?.length || 0;
  const subtaskDone = task.subtasks?.filter((s) => s.done).length || 0;
  const hasSubtasks = subtaskTotal > 0;
  const subtaskPercent = hasSubtasks ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;
  const isOverdue = task.dueDate && task.status !== 'Done' && new Date(task.dueDate) < new Date();
  const visibleLabels = (task.labels || []).slice(0, 4);
  const extraLabels = (task.labels || []).length - visibleLabels.length;

  return (
    <div
      className={`task-card animate-fade-in ${task.isArchived ? 'task-card-archived' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={() => onClick(task)}
    >
      <div className="task-card-top">
        <span className={`priority-badge ${priorityClass[task.priority]}`}>{task.priority}</span>
        {task.isArchived && (
          <span className="task-archive-badge">
            <Archive size={11} />
            Archived
          </span>
        )}
        {task.dueDate && (
          <span className={`task-due-date ${isOverdue ? 'task-due-overdue' : ''}`}>
            {isOverdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>

      {visibleLabels.length > 0 && (
        <div className="task-labels-row">
          {visibleLabels.map((label, idx) => (
            <span
              key={idx}
              className="task-label-chip"
              style={{
                backgroundColor: `${label.color}22`,
                color: label.color,
                borderColor: `${label.color}55`,
              }}
              title={label.name}
            >
              {label.name}
            </span>
          ))}
          {extraLabels > 0 && (
            <span className="task-label-chip task-label-more">+{extraLabels}</span>
          )}
        </div>
      )}

      <p className="task-card-title">{task.title}</p>

      {hasSubtasks && (
        <div className="task-subtask-progress">
          <div className="task-subtask-bar">
            <div
              className="task-subtask-fill"
              style={{ width: `${subtaskPercent}%` }}
            />
          </div>
          <span className="task-subtask-text">
            <CheckSquare size={11} />
            {subtaskDone}/{subtaskTotal}
          </span>
        </div>
      )}

      <div className="task-card-footer">
        {task.assignedTo ? (
          <div className="task-assignee-info" title={task.assignedTo.name}>
            <User size={12} />
            <span className="task-assignee-name">{task.assignedTo.name}</span>
          </div>
        ) : (
          <span className="task-unassigned">Unassigned</span>
        )}
        {task.assignedTo ? (
          <div className="task-assignee-avatar" title={task.assignedTo.name}>
            {task.assignedTo.name.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="task-assignee-avatar task-assignee-empty" title="Unassigned">?</div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;