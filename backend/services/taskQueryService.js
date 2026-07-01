import mongoose from 'mongoose';

const VALID_STATUSES = ['Todo', 'In Progress', 'In Review', 'Done'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];
const VALID_SORT_FIELDS = {
  position: 'position',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  dueDate: 'dueDate',
  priority: 'priority',
  title: 'title',
};
const PRIORITY_ORDER = { Low: 1, Medium: 2, High: 3 };

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.length > 0) return value.split(',');
  return [];
};

const isValidObjectId = (v) => mongoose.isValidObjectId(v);

const buildFilter = (query, projectId) => {
  const filter = { project: projectId };

  const includeArchived = query.includeArchived === 'true';
  if (!includeArchived) filter.isArchived = { $ne: true };

  const statuses = asArray(query.status).filter((s) => VALID_STATUSES.includes(s));
  if (statuses.length > 0) filter.status = { $in: statuses };

  const priorities = asArray(query.priority).filter((p) => VALID_PRIORITIES.includes(p));
  if (priorities.length > 0) filter.priority = { $in: priorities };

  const assignees = asArray(query.assignedTo).filter(isValidObjectId);
  if (assignees.length > 0) filter.assignedTo = { $in: assignees };

  const unassignedOnly = query.unassigned === 'true';
  if (unassignedOnly) filter.assignedTo = null;

  const labels = asArray(query.label).map((l) => l.trim()).filter(Boolean);
  if (labels.length > 0) {
    filter['labels.name'] = { $in: labels };
  }

  if (query.dueBefore) {
    const d = new Date(query.dueBefore);
    if (!Number.isNaN(d.getTime())) {
      filter.dueDate = { ...(filter.dueDate || {}), $lte: d };
    }
  }

  if (query.dueAfter) {
    const d = new Date(query.dueAfter);
    if (!Number.isNaN(d.getTime())) {
      filter.dueDate = { ...(filter.dueDate || {}), $gte: d };
    }
  }

  const overdueOnly = query.overdue === 'true';
  if (overdueOnly) {
    filter.dueDate = { ...(filter.dueDate || {}), $lt: new Date() };
    filter.status = { ...(filter.status || {}), $ne: 'Done' };
  }

  const hasNoDueDate = query.noDueDate === 'true';
  if (hasNoDueDate) {
    filter.dueDate = null;
  }

  if (query.search && query.search.trim().length > 0) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
    ];
  }

  return filter;
};

const buildSort = (query) => {
  const requested = (query.sortBy || 'position').trim();
  const direction = query.sortDir === 'desc' ? -1 : 1;
  const sortField = VALID_SORT_FIELDS[requested] || 'position';

  if (sortField === 'priority') {
    return { _priorityOrder: direction, position: 1, createdAt: 1 };
  }

  return { [sortField]: direction, position: 1, createdAt: 1 };
};

const applyPrioritySort = (tasks, direction) => {
  if (direction === 1) {
    return tasks.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] || 0;
      const pb = PRIORITY_ORDER[b.priority] || 0;
      if (pa !== pb) return pa - pb;
      return (a.position ?? 0) - (b.position ?? 0);
    });
  }
  return tasks.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] || 0;
    const pb = PRIORITY_ORDER[b.priority] || 0;
    if (pa !== pb) return pb - pa;
    return (a.position ?? 0) - (b.position ?? 0);
  });
};

const buildMeta = (query, tasks) => {
  const sortField = (query.sortBy || 'position').trim();
  return {
    total: tasks.length,
    sortBy: sortField,
    sortDir: query.sortDir === 'desc' ? 'desc' : 'asc',
    filters: {
      status: asArray(query.status),
      priority: asArray(query.priority),
      assignedTo: asArray(query.assignedTo),
      label: asArray(query.label),
      search: query.search || '',
      overdue: query.overdue === 'true',
      unassigned: query.unassigned === 'true',
      noDueDate: query.noDueDate === 'true',
      dueBefore: query.dueBefore || null,
      dueAfter: query.dueAfter || null,
      includeArchived: query.includeArchived === 'true',
    },
  };
};

export {
  buildFilter,
  buildSort,
  applyPrioritySort,
  buildMeta,
  VALID_STATUSES,
  VALID_PRIORITIES,
  VALID_SORT_FIELDS,
};