import { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Users } from 'lucide-react';
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

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [projectData, tasksData] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/tasks/project/${projectId}`),
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
  }, [projectId]);

  useEffect(() => {
    if (!socket) return;

    const onCreated = (task) => {
      setTasks((prev) => (prev.some((t) => t._id === task._id) ? prev : [...prev, task]));
    };
    const onUpdated = (task) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    };
    const onDeleted = ({ taskId }) => {
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
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
    socket.on('project:memberAdded', onMemberAdded);
    socket.on('project:memberRemoved', onMemberRemoved);

    return () => {
      socket.off('task:created', onCreated);
      socket.off('task:updated', onUpdated);
      socket.off('task:deleted', onDeleted);
      socket.off('project:memberAdded', onMemberAdded);
      socket.off('project:memberRemoved', onMemberRemoved);
    };
  }, [socket]);

  const handleTaskSaved = (savedTask) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t._id === savedTask._id);
      return exists ? prev.map((t) => (t._id === savedTask._id ? savedTask : t)) : [...prev, savedTask];
    });
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
    async (taskId, newStatus) => {
      const task = tasks.find((t) => t._id === taskId);
      if (!task || task.status === newStatus) {
        return;
      }
      setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)));
      try {
        await api.put(`/tasks/${taskId}`, { status: newStatus });
      } catch (err) {
        setError(err.message || 'Failed to move task');
        setTasks((prev) => prev.map((t) => (t._id === taskId ? task : t)));
      }
    },
    [tasks]
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
            tasks={tasks.filter((t) => t.status === status)}
            onTaskClick={(task) => setActiveTask(task)}
            onAddClick={(status) => {
              setCreateStatus(status);
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
