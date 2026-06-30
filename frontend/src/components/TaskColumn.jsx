import { Plus } from 'lucide-react';
import TaskCard from './TaskCard';

const TaskColumn = ({ status, tasks, onTaskClick, onAddClick, onDrop, onDragStart }) => {
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/taskId');
    if (taskId) onDrop(taskId, status);
  };

  return (
    <div className="task-column" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="task-column-header">
        <div className="task-column-title">
          <span>{status}</span>
          <span className="task-column-count">{tasks.length}</span>
        </div>
        <button className="task-column-add" onClick={() => onAddClick(status)} title="Add task">
          <Plus size={16} />
        </button>
      </div>

      <div className="task-column-body">
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} onClick={onTaskClick} onDragStart={onDragStart} />
        ))}
        {tasks.length === 0 && <div className="task-column-empty">No tasks</div>}
      </div>
    </div>
  );
};

export default TaskColumn;
