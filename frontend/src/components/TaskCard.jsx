import { Calendar, MessageSquare } from 'lucide-react';

const priorityClass = {
  Low: 'priority-low',
  Medium: 'priority-medium',
  High: 'priority-high',
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
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>

      <p className="task-card-title">{task.title}</p>

      <div className="task-card-footer">
        <div className="task-comment-count">
          <MessageSquare size={13} />
          <span>{task.commentCount ?? ''}</span>
        </div>
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
