import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import TaskCard from './TaskCard';

const TaskColumn = ({ status, tasks, onTaskClick, onAddClick, onDrop, onDragStart }) => {
  const containerRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDragOverEmpty, setIsDragOverEmpty] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget === containerRef.current && !containerRef.current.contains(e.relatedTarget)) {
      setDragOverIndex(null);
      setIsDragOverEmpty(false);
    }
  };

  const handleCardDragOver = (e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(idx);
    setIsDragOverEmpty(false);
  };

  const handleCardDrop = (e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData('text/taskId');
    setDragOverIndex(null);
    setIsDragOverEmpty(false);
    if (taskId) onDrop(taskId, status, idx);
  };

  const handleEmptyDrop = (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/taskId');
    setDragOverIndex(null);
    setIsDragOverEmpty(false);
    if (taskId) onDrop(taskId, status, tasks.length);
  };

  const handleEmptyDragOver = (e) => {
    e.preventDefault();
    setIsDragOverEmpty(true);
  };

  return (
    <div
      className="task-column"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="task-column-header">
        <div className="task-column-title">
          <span>{status}</span>
          <span className="task-column-count">{tasks.length}</span>
        </div>
        <button className="task-column-add" onClick={() => onAddClick(status)} title="Add task">
          <Plus size={16} />
        </button>
      </div>

      <div className="task-column-body" ref={containerRef}>
        {tasks.map((task, idx) => (
          <div
            key={task._id}
            onDragOver={(e) => handleCardDragOver(e, idx)}
            onDrop={(e) => handleCardDrop(e, idx)}
            className={dragOverIndex === idx ? 'task-drop-target' : ''}
          >
            <TaskCard task={task} onClick={onTaskClick} onDragStart={onDragStart} />
          </div>
        ))}
        {tasks.length === 0 && (
          <div
            className={`task-column-empty ${isDragOverEmpty ? 'task-column-empty-drop' : ''}`}
            onDragOver={handleEmptyDragOver}
            onDrop={handleEmptyDrop}
          >
            {isDragOverEmpty ? 'Drop here' : 'No tasks'}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskColumn;