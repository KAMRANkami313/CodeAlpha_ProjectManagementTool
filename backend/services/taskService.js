import Task from '../models/Task.js';
import AppError from '../utils/AppError.js';
import { broadcastToProject } from './realtimeService.js';
import { notifyUser } from './notificationService.js';

const isMember = (project, userId) =>
  project?.members?.some((m) => m.toString?.() === userId.toString());

const assertMember = (project, userId) => {
  if (!project) throw new AppError('Project not found', 404);
  if (!isMember(project, userId)) throw new AppError('Access denied to this project', 403);
};

const assertCanAssign = (project, assigneeId) => {
  if (assigneeId && !isMember(project, assigneeId)) {
    throw new AppError('Cannot assign task to a non-member of this project', 400);
  }
};

const setStatusTimestamps = (task, newStatus) => {
  if (newStatus === 'Done' && !task.completedAt) {
    task.completedAt = new Date();
  } else if (newStatus !== 'Done' && task.completedAt) {
    task.completedAt = null;
  }
};

const buildTaskPayload = async (task) => {
  await task.populate([
    { path: 'assignedTo', select: 'name email' },
    { path: 'createdBy', select: 'name email' },
  ]);
  return task;
};

const createTask = async ({ project, body, actor }) => {
  assertMember(project, actor._id);
  assertCanAssign(project, body.assignedTo);

  const task = await Task.create({
    title: body.title,
    description: body.description,
    status: body.status,
    priority: body.priority,
    project: project._id,
    assignedTo: body.assignedTo || null,
    dueDate: body.dueDate || null,
    createdBy: actor._id,
    labels: Array.isArray(body.labels) ? body.labels : [],
    subtasks: Array.isArray(body.subtasks) ? body.subtasks.map((s) => ({
      title: s.title,
      done: Boolean(s.done),
      createdBy: actor._id,
    })) : [],
    timeEstimateMinutes: body.timeEstimateMinutes ?? null,
  });

  if (task.status === 'Done') task.completedAt = new Date();
  await task.save();

  const populated = await buildTaskPayload(task);
  broadcastToProject(project._id, 'task:created', populated);

  if (body.assignedTo && body.assignedTo !== actor._id.toString()) {
    await notifyUser({
      recipient: body.assignedTo,
      sender: actor._id,
      type: 'TASK_ASSIGNED',
      message: `${actor.name} assigned you the task "${task.title}"`,
      project: project._id,
      task: task._id,
    });
  }

  return populated;
};

const updateTask = async ({ task, project, body, actor }) => {
  assertMember(project, actor._id);

  if (body.assignedTo !== undefined) {
    assertCanAssign(project, body.assignedTo);
  }

  const previousStatus = task.status;
  const previousAssignee = task.assignedTo ? task.assignedTo.toString() : null;

  if (body.title !== undefined) task.title = body.title;
  if (body.description !== undefined) task.description = body.description;
  if (body.priority !== undefined) task.priority = body.priority;
  if (body.assignedTo !== undefined) task.assignedTo = body.assignedTo;
  if (body.dueDate !== undefined) task.dueDate = body.dueDate;
  if (body.timeEstimateMinutes !== undefined) task.timeEstimateMinutes = body.timeEstimateMinutes;
  if (body.timeSpentMinutes !== undefined) {
    task.timeSpentMinutes = Math.max(0, Number(body.timeSpentMinutes) || 0);
  }
  if (Array.isArray(body.labels)) task.labels = body.labels;

  if (body.status !== undefined && body.status !== task.status) {
    task.status = body.status;
    setStatusTimestamps(task, body.status);
  }

  await task.save();
  const updated = await buildTaskPayload(task);

  broadcastToProject(project._id, 'task:updated', updated);

  if (body.assignedTo && body.assignedTo !== previousAssignee && body.assignedTo !== actor._id.toString()) {
    await notifyUser({
      recipient: body.assignedTo,
      sender: actor._id,
      type: 'TASK_ASSIGNED',
      message: `${actor.name} assigned you the task "${task.title}"`,
      project: project._id,
      task: task._id,
    });
  }

  if (body.status && body.status !== previousStatus) {
    const recipient = task.assignedTo && task.assignedTo.toString() !== actor._id.toString()
      ? task.assignedTo
      : previousAssignee && previousAssignee !== actor._id.toString()
        ? previousAssignee
        : null;
    if (recipient) {
      await notifyUser({
        recipient,
        sender: actor._id,
        type: 'TASK_STATUS_CHANGED',
        message: `${actor.name} moved "${task.title}" to ${body.status}`,
        project: project._id,
        task: task._id,
      });
    }
  }

  return updated;
};

const archiveTask = async ({ task, project, actor }) => {
  assertMember(project, actor._id);
  if (task.isArchived) return buildTaskPayload(task);

  task.isArchived = true;
  task.archivedAt = new Date();
  await task.save();

  const updated = await buildTaskPayload(task);
  broadcastToProject(project._id, 'task:updated', updated);
  return updated;
};

const unarchiveTask = async ({ task, project, actor }) => {
  assertMember(project, actor._id);
  if (!task.isArchived) return buildTaskPayload(task);

  task.isArchived = false;
  task.archivedAt = null;
  await task.save();

  const updated = await buildTaskPayload(task);
  broadcastToProject(project._id, 'task:updated', updated);
  return updated;
};

const reorderTask = async ({ task, project, newStatus, newPosition, actor }) => {
  assertMember(project, actor._id);

  if (newStatus && !['Todo', 'In Progress', 'In Review', 'Done'].includes(newStatus)) {
    throw new AppError('Invalid status', 400);
  }

  const targetStatus = newStatus || task.status;
  const targetPosition = typeof newPosition === 'number' ? newPosition : task.position;

  if (targetStatus !== task.status) {
    task.status = targetStatus;
    setStatusTimestamps(task, targetStatus);
  }

  const siblings = await Task.find({
    project: project._id,
    status: targetStatus,
    _id: { $ne: task._id },
  })
    .sort({ position: 1, createdAt: 1 })
    .select('_id position');

  const ordered = siblings.map((s) => s._id);
  ordered.splice(Math.max(0, Math.min(targetPosition, ordered.length)), 0, task._id);

  const bulk = ordered.map((id, idx) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { position: idx } },
    },
  }));

  if (bulk.length > 0) {
    await Task.bulkWrite(bulk);
  }

  task.position = targetPosition;
  await task.save();

  const updated = await buildTaskPayload(task);
  broadcastToProject(project._id, 'task:updated', updated);

  const allTasks = await Task.find({ project: project._id, status: targetStatus })
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .sort({ position: 1, createdAt: 1 });

  broadcastToProject(project._id, 'tasks:reordered', {
    projectId: project._id,
    status: targetStatus,
    tasks: allTasks,
  });

  return updated;
};

const addSubtask = async ({ task, project, title, actor }) => {
  assertMember(project, actor._id);
  if (!title || !title.trim()) throw new AppError('Subtask title is required', 400);

  task.subtasks.push({
    title: title.trim(),
    done: false,
    createdBy: actor._id,
  });
  await task.save();

  const updated = await buildTaskPayload(task);
  broadcastToProject(project._id, 'task:updated', updated);
  return updated;
};

const toggleSubtask = async ({ task, project, subtaskId, done, actor }) => {
  assertMember(project, actor._id);
  const sub = task.subtasks.id(subtaskId);
  if (!sub) throw new AppError('Subtask not found', 404);

  sub.done = Boolean(done);
  sub.completedAt = sub.done ? new Date() : null;
  await task.save();

  const allDone = task.subtasks.length > 0 && task.subtasks.every((s) => s.done);
  if (allDone && task.status !== 'Done') {
    task.status = 'Done';
    task.completedAt = new Date();
    await task.save();
  }

  const updated = await buildTaskPayload(task);
  broadcastToProject(project._id, 'task:updated', updated);
  return updated;
};

const updateSubtask = async ({ task, project, subtaskId, title, actor }) => {
  assertMember(project, actor._id);
  const sub = task.subtasks.id(subtaskId);
  if (!sub) throw new AppError('Subtask not found', 404);
  if (title !== undefined) {
    if (!title.trim()) throw new AppError('Subtask title cannot be empty', 400);
    sub.title = title.trim();
  }
  await task.save();

  const updated = await buildTaskPayload(task);
  broadcastToProject(project._id, 'task:updated', updated);
  return updated;
};

const deleteSubtask = async ({ task, project, subtaskId, actor }) => {
  assertMember(project, actor._id);
  const sub = task.subtasks.id(subtaskId);
  if (!sub) throw new AppError('Subtask not found', 404);
  sub.deleteOne();
  await task.save();

  const updated = await buildTaskPayload(task);
  broadcastToProject(project._id, 'task:updated', updated);
  return updated;
};

const deleteTask = async ({ task, project, actor }) => {
  assertMember(project, actor._id);

  const projectId = project._id;
  const taskId = task._id;

  const { default: Comment } = await import('../models/Comment.js');
  const { default: withTransaction } = await import('../utils/withTransaction.js');

  await withTransaction(async (session) => {
    await Comment.deleteMany({ task: taskId }, { session });
    await Task.deleteOne({ _id: taskId }, { session });
  });

  broadcastToProject(projectId, 'task:deleted', { taskId, projectId });
};

export {
  createTask,
  updateTask,
  archiveTask,
  unarchiveTask,
  reorderTask,
  addSubtask,
  toggleSubtask,
  updateSubtask,
  deleteSubtask,
  deleteTask,
};