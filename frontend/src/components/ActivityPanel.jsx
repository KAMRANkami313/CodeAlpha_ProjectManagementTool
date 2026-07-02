import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity as ActivityIcon,
  X,
  FolderPlus,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  ClipboardList,
  UserCheck,
  UserX,
  ArrowRightLeft,
  Zap,
  Calendar,
  Archive,
  ArchiveRestore,
  Tag,
  ListChecks,
  CheckSquare,
  MessageSquare,
  Circle,
} from 'lucide-react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';

const TYPE_ICON = {
  PROJECT_CREATED: FolderPlus,
  PROJECT_UPDATED: Pencil,
  PROJECT_DELETED: Trash2,
  PROJECT_MEMBER_ADDED: UserPlus,
  PROJECT_MEMBER_REMOVED: UserMinus,
  TASK_CREATED: ClipboardList,
  TASK_UPDATED: Pencil,
  TASK_DELETED: Trash2,
  TASK_ASSIGNED: UserCheck,
  TASK_UNASSIGNED: UserX,
  TASK_STATUS_CHANGED: ArrowRightLeft,
  TASK_PRIORITY_CHANGED: Zap,
  TASK_DUE_DATE_CHANGED: Calendar,
  TASK_ARCHIVED: Archive,
  TASK_UNARCHIVED: ArchiveRestore,
  TASK_LABELS_CHANGED: Tag,
  SUBTASK_CREATED: ListChecks,
  SUBTASK_UPDATED: Pencil,
  SUBTASK_TOGGLED: CheckSquare,
  SUBTASK_DELETED: Trash2,
  COMMENT_CREATED: MessageSquare,
};

const TYPE_COLOR = {
  PROJECT_CREATED: '#22c55e',
  PROJECT_UPDATED: '#3b82f6',
  PROJECT_DELETED: '#ef4444',
  PROJECT_MEMBER_ADDED: '#22c55e',
  PROJECT_MEMBER_REMOVED: '#f97316',
  TASK_CREATED: '#22c55e',
  TASK_UPDATED: '#3b82f6',
  TASK_DELETED: '#ef4444',
  TASK_ASSIGNED: '#6366f1',
  TASK_UNASSIGNED: '#64748b',
  TASK_STATUS_CHANGED: '#06b6d4',
  TASK_PRIORITY_CHANGED: '#f59e0b',
  TASK_DUE_DATE_CHANGED: '#8b5cf6',
  TASK_ARCHIVED: '#64748b',
  TASK_UNARCHIVED: '#10b981',
  TASK_LABELS_CHANGED: '#a855f7',
  SUBTASK_CREATED: '#3b82f6',
  SUBTASK_UPDATED: '#3b82f6',
  SUBTASK_TOGGLED: '#22c55e',
  SUBTASK_DELETED: '#ef4444',
  COMMENT_CREATED: '#ec4899',
};

const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

const PAGE_SIZE = 20;

const ActivityPanel = ({ projectId, onClose }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState('');
  const { socket } = useSocket();
  const scrollRef = useRef(null);

  const loadActivity = useCallback(async (pageNum, typeFilter, replace = true) => {
    try {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      const params = new URLSearchParams({ page: String(pageNum), limit: String(PAGE_SIZE) });
      if (typeFilter) params.set('type', typeFilter);
      const res = await api.get(`/projects/${projectId}/activity?${params}`);
      setActivities((prev) => replace ? res.data : [...prev, ...res.data]);
      setTotalPages(res.pagination.totalPages);
      setPage(pageNum);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadActivity(1, filterType, true);
  }, [loadActivity, filterType]);

  useEffect(() => {
    if (!socket) return;
    const handleNew = (activity) => {
      if (filterType && activity.type !== filterType) return;
      const activityProjectId = activity.project?._id || activity.project;
      if (String(activityProjectId) !== String(projectId)) return;
      setActivities((prev) => {
        if (prev.some((a) => a._id === activity._id)) return prev;
        return [activity, ...prev].slice(0, 100);
      });
    };
    socket.on('activity:new', handleNew);
    return () => socket.off('activity:new', handleNew);
  }, [socket, projectId, filterType]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      loadActivity(page + 1, filterType, false);
    }
  };

  const handleFilterChange = (e) => {
    setFilterType(e.target.value);
  };

  return (
    <aside className="activity-panel" aria-label="Project activity">
      <div className="activity-panel-header">
        <div className="activity-panel-title">
          <ActivityIcon size={18} />
          <span>Activity</span>
        </div>
        <div className="activity-panel-actions">
          <select
            value={filterType}
            onChange={handleFilterChange}
            className="activity-filter-select"
            aria-label="Filter by type"
          >
            <option value="">All activity</option>
            <optgroup label="Tasks">
              <option value="TASK_CREATED">Created</option>
              <option value="TASK_UPDATED">Updated</option>
              <option value="TASK_STATUS_CHANGED">Status changed</option>
              <option value="TASK_PRIORITY_CHANGED">Priority changed</option>
              <option value="TASK_DUE_DATE_CHANGED">Due date changed</option>
              <option value="TASK_ASSIGNED">Assigned</option>
              <option value="TASK_UNASSIGNED">Unassigned</option>
              <option value="TASK_ARCHIVED">Archived</option>
              <option value="TASK_UNARCHIVED">Unarchived</option>
              <option value="TASK_LABELS_CHANGED">Labels changed</option>
              <option value="TASK_DELETED">Deleted</option>
            </optgroup>
            <optgroup label="Subtasks">
              <option value="SUBTASK_CREATED">Subtask created</option>
              <option value="SUBTASK_TOGGLED">Subtask toggled</option>
              <option value="SUBTASK_UPDATED">Subtask updated</option>
              <option value="SUBTASK_DELETED">Subtask deleted</option>
            </optgroup>
            <optgroup label="Project">
              <option value="PROJECT_UPDATED">Project updated</option>
              <option value="PROJECT_MEMBER_ADDED">Member added</option>
              <option value="PROJECT_MEMBER_REMOVED">Member removed</option>
            </optgroup>
            <optgroup label="Comments">
              <option value="COMMENT_CREATED">Comments</option>
            </optgroup>
          </select>
          <button className="activity-panel-close" onClick={onClose} aria-label="Close activity panel">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="activity-list" ref={scrollRef}>
        {loading ? (
          <div className="activity-empty">Loading activity…</div>
        ) : error ? (
          <div className="activity-empty activity-error">{error}</div>
        ) : activities.length === 0 ? (
          <div className="activity-empty">No activity yet.</div>
        ) : (
          <>
            {activities.map((activity) => {
              const Icon = TYPE_ICON[activity.type] || Circle;
              const color = TYPE_COLOR[activity.type] || '#64748b';
              const actorName = activity.actor?.name || 'Someone';
              const actionText = activity.summary.startsWith(actorName)
                ? activity.summary.slice(actorName.length).trim()
                : activity.summary;
              return (
                <div key={activity._id} className="activity-item">
                  <div className="activity-icon" style={{ color, borderColor: `${color}55` }}>
                    <Icon size={14} />
                  </div>
                  <div className="activity-content">
                    <p className="activity-summary">
                      <span className="activity-actor">{actorName}</span>
                      {' '}
                      <span className="activity-text">{actionText}</span>
                    </p>
                    <div className="activity-meta">
                      <span className="activity-time">{timeAgo(activity.createdAt)}</span>
                      {activity.task && (
                        <span className="activity-task-link" title="Related task">
                          #{String(activity.task).slice(-6)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {page < totalPages && (
              <button
                className="activity-load-more"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : `Load more (${activities.length}/${totalPages * PAGE_SIZE})`}
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

export default ActivityPanel;