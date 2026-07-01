import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Users, Archive } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import useProjectRoom from '../hooks/useProjectRoom';
import useDebounce from '../hooks/useDebounce';
import { api } from '../services/api';
import TaskColumn from '../components/TaskColumn';
import TaskModal from '../components/TaskModal';
import TaskCommentsModal from '../components/TaskCommentsModal';
import MembersModal from '../components/MembersModal';
import NotificationBell from '../components/NotificationBell';
import ReconnectionBanner from '../components/ReconnectionBanner';
import TaskFilterBar from '../components/TaskFilterBar';

const STATUSES = ['Todo', 'In Progress', 'In Review', 'Done'];

const DEFAULT_FILTERS = {
  search: '',
  status: [],
  priority: [],
  assignedTo: [],
  label: [],
  overdue: false,
  unassigned: false,
  noDueDate: false,
  includeArchived: false,
  sortBy: 'position',
  sortDir: 'asc',
};

const buildQueryString = (filters) => {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.status.length > 0) params.set('status', filters.status.join(','));
  if (filters.priority.length > 0) params.set('priority', filters.priority.join(','));
  if (filters.assignedTo.length > 0) params.set('assignedTo', filters.assignedTo.join(','));
  if (filters.label.length > 0) params.set('label', filters.label.join(','));
  if (filters.overdue) params.set('overdue', 'true');
  if (filters.unassigned) params.set('unassigned', 'true');
  if (filters.noDueDate) params.set('noDueDate', 'true');
  if (filters.includeArchived) params.set('includeArchived', 'true');
  if (filters.sortBy && filters.sortBy !== 'position') params.set('sortBy', filters.sortBy);
  if (filters.sortDir === 'desc') params.set('sortDir', 'desc');
  return params.toString();
};

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

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const debouncedSearch = useDebounce(filters.search, 300);
  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const hasActiveFilters = useMemo(() => {
    return (
      effectiveFilters.search.trim() !== '' ||
      effectiveFilters.status.length > 0 ||
      effectiveFilters.priority.length > 0 ||
      effectiveFilters.assignedTo.length > 0 ||
      effectiveFilters.label.length > 0 ||
      effectiveFilters.overdue ||
      effectiveFilters.unassigned ||
      effectiveFilters.noDueDate ||
      effectiveFilters.includeArchived ||
      effectiveFilters.sortBy !== 'position' ||
      effectiveFilters.sortDir !== 'asc'
    );
  }, [effectiveFilters]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, includeArchived: showArchived }));
  }, [showArchived]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [projectData, tasksData] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/tasks/project/${projectId}?${buildQueryString(effectiveFilters)}`),
        ]);
        if (active) {
          setProject(projectData);
          const list = Array.isArray(tasksData) ? tasksData : tasksData.data || [];
          setTasks(list);
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
  }, [projectId, effectiveFilters]);

  useEffect(() => {
    if (!socket) return;

    const onCreated = (task) => {
      if (task.isArchived && !effectiveFilters.includeArchived) return;
      setTasks((prev) => (prev.some((t) => t._id === task._id) ? prev : [...prev, task]));
    };
    const onUpdated = (task) => {
      setTasks((prev) => {
        if (task.isArchived && !effectiveFilters.includeArchived) {
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
      if (effectiveFilters.sortBy !== 'position') return;
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
  }, [socket, effectiveFilters.includeArchived, effectiveFilters.sortBy]);

  const handleTaskSaved = (savedTask) => {
    setTasks((prev) => {
      if (savedTask.isArchived && !effectiveFilters.includeArchived) {
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
      if (hasActiveFilters) {
        setError('Cannot reorder while filters are active. Clear filters to reorder.');
        setTimeout(() => setError(''), 3000);
        return;
      }

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
          const fresh = await api.get(`/tasks/project/${projectId}?${buildQueryString(effectiveFilters)}`);
          setTasks(Array.isArray(fresh) ? fresh : fresh.data || []);
        } catch {}
      }
    },
    [tasks, projectId, effectiveFilters, hasActiveFilters]
  );

  const handleResetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS, includeArchived: showArchived });
  };

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

      <TaskFilterBar
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        members={project.members}
        resultCount={tasks.length}
      />

      {error && <div className="auth-error board-error-block">{error}</div>}

      {hasActiveFilters && (
        <div className="task-filter-active-notice">
          Filters are active — drag-drop reordering is disabled. <button onClick={handleResetFilters}>Clear filters</button>
        </div>
      )}

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