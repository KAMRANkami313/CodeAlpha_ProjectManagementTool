import { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Users, Archive } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import useProjectRoom from '../hooks/useProjectRoom';
import { api } from '../services/api';
import TaskColumn from '../components/TaskColumn';
import TaskModal from '../components/TaskModal';
import TaskCommentsModal from '../components/TaskCommentsModal';
import MembersModal from '../components/MembersModal';
import NotificationBell from '../components/NotificationBell';
import ReconnectionBanner from '../components/ReconnectionBanner';

const STATUSES = ['Todo', 'In Progress', 'In Review', 'Done'];

const Board = () => {
  const { projectId } = useParams();
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  useProjectRoom(projectId);

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTask, setActiveTask] = useState(null);
  const [editingTask, setEditingTask] = useState(undefined);
  const [createStatus, setCreateStatus] = useState('Todo');
  const [showMembers, setShowMembers] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [projectData, tasksData] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/tasks/project/${projectId}?includeArchived=${showArchived}`),
        ]);
        if (active) {
          setProject(projectData);
          setTasks(tasksData);
        }
      } catch (err) {
        if (active) setError(err.message || 'Failed to load project');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [projectId, showArchived]);

  useEffect(() => {
    if (!socket) return;

    const onCreated = (task) => {
      if (task.isArchived && !showArchived) return;
      setTasks((prev) => (prev.some((t) => t._id === task._id) ? prev : [...prev, task]));
    };
    const onUpdated = (task) => {
      setTasks((prev) => {
        if (task.isArchived && !showArchived) {
          return prev.filter((t) => t._id !== task._id);
        }
        const exists = prev.some((t) => t._id === task._id);
        return exists ? prev.map((t) => (t._id === task._id ? task : t)) : [...prev, task];
      });
    };
    const onDeleted = ({ taskId }) => {
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    };
    const onReordered = ({ status, tasks: reorderedTasks }) => {
      setTasks((prev) => {
        const reorderedIds = new Set(reorderedTasks.map((t) => t._id));
        const others = prev.filter((t) => !reorderedIds.has(t._id));
        return [...others, ...reorderedTasks];
      });
    };
    const onMemberAdded = ({ member }) => {
      setProject((prev) =>
        prev ? { ...prev, members: [...prev.members.filter((m) => m._id !== member._id), member] } : prev
      );
    };
    const onMemberRemoved = ({ userId }) => {
      setProject((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m._id !== userId) } : prev
      );
    };

    socket.on('task:created', onCreated);
    socket.on('task:updated', onUpdated);
    socket.on('task:deleted', onDeleted);
    socket.on('tasks:reordered', onReordered);
    socket.on('project:memberAdded', onMemberAdded);
    socket.on('project:memberRemoved', onMemberRemoved);

    return () => {
      socket.off('task:created', onCreated);
      socket.off('task:updated', onUpdated);
      socket.off('task:deleted', onDeleted);
      socket.off('tasks:reordered', onReordered);
      socket.off('project:memberAdded', onMemberAdded);
      socket.off('project:memberRemoved', onMemberRemoved);
    };
  }, [socket, showArchived]);

  const handleTaskSaved = (savedTask) => {
    setTasks((prev) => {
      if (savedTask.isArchived && !showArchived) {
        return prev.filter((t) => t._id !== savedTask._id);
      }
      const exists = prev.some((t) => t._id === savedTask._id);
      return exists ? prev.map((t) => (t._id === savedTask._id ? savedTask : t)) : [...prev, savedTask];
    });
    if (activeTask?._id === savedTask._id) setActiveTask(savedTask);
    setEditingTask(undefined);
  };

  const handleTaskDeleted = (taskId) => {
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    setEditingTask(undefined);
    if (activeTask?._id === taskId) setActiveTask(null);
  };

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('text/taskId', task._id);
  };

  const handleDrop = useCallback(
    async (taskId, newStatus, dropIndex) => {
      const task = tasks.find((t) => t._id === taskId);
      if (!task) return;

      const sameStatus = task.status === newStatus;
      if (sameStatus && typeof dropIndex !== 'number') return;

      const columnTasks = tasks
        .filter((t) => t.status === newStatus && t._id !== taskId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const clampedIndex = Math.max(0, Math.min(dropIndex ?? columnTasks.length, columnTasks.length));
      columnTasks.splice(clampedIndex, 0, { ...task, status: newStatus });

      setTasks((prev) => {
        const otherStatusTasks = prev.filter((t) => t.status !== newStatus && t._id !== taskId);
        const reorderedColumn = columnTasks.map((t, idx) => ({ ...t, position: idx }));
        return [...otherStatusTasks, ...reorderedColumn];
      });

      try {
        await api.put(`/tasks/${taskId}/reorder`, {
          status: newStatus,
          position: clampedIndex,
        });
      } catch (err) {
        setError(err.message || 'Failed to move task');
        try {
          const fresh = await api.get(`/tasks/project/${projectId}?includeArchived=${showArchived}`);
          setTasks(fresh);
        } catch {}
      }
    },
    [tasks, projectId, showArchived]
  );

  if (loading) {
    return <div className="state-message">Loading board...</div>;
  }

  if (error && !project) {
    return (
      <div className="board-error-state">
        <p className="auth-error board-error-inline">{error}</p>
        <Link to="/" className="auth-link">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="board-page">
      <ReconnectionBanner />
      <header className="board-header">
        <div className="board-header-left">
          <Link to="/" className="board-back-link" aria-label="Back to dashboard">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="board-title">{project.name}</h1>
            {project.description && <p className="board-subtitle">{project.description}</p>}
          </div>
        </div>

        <div className="board-header-right">
          <button
            className={`btn-secondary ${showArchived ? 'btn-secondary-active' : ''}`}
            onClick={() => setShowArchived((v) => !v)}
            title={showArchived ? 'Hide archived tasks' : 'Show archived tasks'}
          >
            <Archive size={16} />
            <span>{showArchived ? 'Hide Archived' : 'Archived'}</span>
          </button>
          <button className="btn-secondary" onClick={() => setShowMembers(true)}>
            <Users size={16} />
            <span>{project.members.length} Members</span>
          </button>
          <NotificationBell />
        </div>
      </header>

      {error && <div className="auth-error board-error-block">{error}</div>}

      <div className="board-columns">
        {STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={tasks
              .filter((t) => t.status === status)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))}
            onTaskClick={(task) => setActiveTask(task)}
            onAddClick={(s) => {
              setCreateStatus(s);
              setEditingTask(null);
            }}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
          />
        ))}
      </div>

      <button
        className="fab-add-task"
        onClick={() => {
          setCreateStatus('Todo');
          setEditingTask(null);
        }}
        title="Add a task"
        aria-label="Add a task"
      >
        <Plus size={22} />
      </button>

      {editingTask !== undefined && (
        <TaskModal
          projectId={projectId}
          members={project.members}
          task={editingTask}
          defaultStatus={createStatus}
          onClose={() => setEditingTask(undefined)}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}

      {activeTask && (
        <TaskCommentsModal
          task={activeTask}
          currentUser={user}
          onClose={() => setActiveTask(null)}
          onEdit={() => {
            setEditingTask(activeTask);
            setActiveTask(null);
          }}
          onTaskUpdated={(updated) => setActiveTask(updated)}
        />
      )}

      {showMembers && (
        <MembersModal
          project={project}
          currentUser={user}
          onClose={() => setShowMembers(false)}
          onMembersUpdated={(updated) => setProject(updated)}
        />
      )}
    </div>
  );
};

export default Board;