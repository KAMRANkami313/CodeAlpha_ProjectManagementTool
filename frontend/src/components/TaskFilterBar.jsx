import { useState, useRef, useEffect } from 'react';
import { Search, X, Filter, ArrowUpDown, RotateCcw } from 'lucide-react';

const STATUSES = ['Todo', 'In Progress', 'In Review', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const SORT_OPTIONS = [
  { value: 'position', label: 'Manual order' },
  { value: 'createdAt', label: 'Created date' },
  { value: 'updatedAt', label: 'Updated date' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title (A–Z)' },
];

const toggleInArray = (arr, value) =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

const TaskFilterBar = ({ filters, onChange, members, onReset, resultCount }) => {
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const update = (patch) => onChange({ ...filters, ...patch });

  const activeFilterCount =
    filters.status.length +
    filters.priority.length +
    filters.assignedTo.length +
    filters.label.length +
    (filters.search ? 1 : 0) +
    (filters.overdue ? 1 : 0) +
    (filters.unassigned ? 1 : 0) +
    (filters.noDueDate ? 1 : 0) +
    (filters.includeArchived ? 1 : 0);

  const handleLabelInput = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      e.preventDefault();
      const value = e.target.value.trim();
      if (!filters.label.includes(value)) {
        update({ label: [...filters.label, value] });
      }
      e.target.value = '';
    }
  };

  const removeLabel = (label) => {
    update({ label: filters.label.filter((l) => l !== label) });
  };

  return (
    <div className="task-filter-bar" ref={filterRef}>
      <div className="task-filter-bar-main">
        <div className="task-filter-search">
          <Search size={16} className="task-filter-search-icon" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="task-filter-search-input"
          />
          {filters.search && (
            <button
              className="task-filter-clear-btn"
              onClick={() => update({ search: '' })}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          className={`btn-secondary task-filter-toggle ${showFilters || activeFilterCount > 0 ? 'task-filter-toggle-active' : ''}`}
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <Filter size={16} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="task-filter-count">{activeFilterCount}</span>
          )}
        </button>

        <div className="task-filter-sort">
          <ArrowUpDown size={14} />
          <select
            value={filters.sortBy}
            onChange={(e) => update({ sortBy: e.target.value })}
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            className="task-filter-sort-dir"
            onClick={() => update({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })}
            aria-label={`Sort ${filters.sortDir === 'asc' ? 'ascending' : 'descending'}`}
            title={filters.sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {filters.sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {activeFilterCount > 0 && (
          <button
            className="task-filter-reset"
            onClick={onReset}
            title="Reset all filters"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        )}

        {typeof resultCount === 'number' && (
          <span className="task-filter-result-count">
            {resultCount} {resultCount === 1 ? 'task' : 'tasks'}
          </span>
        )}
      </div>

      {showFilters && (
        <div className="task-filter-panel animate-fade-in">
          <div className="task-filter-group">
            <span className="task-filter-group-label">Status</span>
            <div className="task-filter-chips">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  className={`task-filter-chip ${filters.status.includes(s) ? 'task-filter-chip-active' : ''}`}
                  onClick={() => update({ status: toggleInArray(filters.status, s) })}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="task-filter-group">
            <span className="task-filter-group-label">Priority</span>
            <div className="task-filter-chips">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  className={`task-filter-chip priority-chip-${p.toLowerCase()} ${filters.priority.includes(p) ? 'task-filter-chip-active' : ''}`}
                  onClick={() => update({ priority: toggleInArray(filters.priority, p) })}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="task-filter-group">
            <span className="task-filter-group-label">Assignee</span>
            <div className="task-filter-chips">
              <button
                className={`task-filter-chip ${filters.unassigned ? 'task-filter-chip-active' : ''}`}
                onClick={() => update({ unassigned: !filters.unassigned, assignedTo: [] })}
              >
                Unassigned
              </button>
              {members.map((m) => (
                <button
                  key={m._id}
                  className={`task-filter-chip ${filters.assignedTo.includes(m._id) ? 'task-filter-chip-active' : ''}`}
                  onClick={() =>
                    update({
                      assignedTo: toggleInArray(filters.assignedTo, m._id),
                      unassigned: false,
                    })
                  }
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="task-filter-group">
            <span className="task-filter-group-label">Due date</span>
            <div className="task-filter-chips">
              <button
                className={`task-filter-chip ${filters.overdue ? 'task-filter-chip-active' : ''}`}
                onClick={() => update({ overdue: !filters.overdue, noDueDate: false })}
              >
                Overdue
              </button>
              <button
                className={`task-filter-chip ${filters.noDueDate ? 'task-filter-chip-active' : ''}`}
                onClick={() => update({ noDueDate: !filters.noDueDate, overdue: false })}
              >
                No due date
              </button>
            </div>
          </div>

          <div className="task-filter-group">
            <span className="task-filter-group-label">Labels</span>
            <div className="task-filter-labels">
              {filters.label.map((label) => (
                <span key={label} className="task-filter-label-pill">
                  {label}
                  <button onClick={() => removeLabel(label)} aria-label={`Remove ${label} label`}>
                    <X size={11} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder="Type label + Enter"
                onKeyDown={handleLabelInput}
                className="task-filter-label-input"
              />
            </div>
          </div>

          <div className="task-filter-group">
            <span className="task-filter-group-label">Archived</span>
            <label className="task-filter-toggle-row">
              <input
                type="checkbox"
                checked={filters.includeArchived}
                onChange={(e) => update({ includeArchived: e.target.checked })}
              />
              <span>Show archived tasks</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskFilterBar;