import { Calendar, User } from 'lucide-react';

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
  return (
    <div
      className="task-card animate-fade-in"
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={() => onClick(task)}
    >
      <div className="task-card-top">
        <span className={`priority-badge ${priorityClass[task.priority]}`}>{task.priority}</span>
        {task.dueDate && (
          <span className="task-due-date">
            <Calendar size={12} />
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>

      <p className="task-card-title">{task.title}</p>

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
          <div className="task-assignee-avatar task-assignee-empty" title="Unassigned">
            ?
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
