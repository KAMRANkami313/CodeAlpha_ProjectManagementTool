import Task from '../models/Task.js';
import AppError from '../utils/AppError.js';
import { broadcastToProject } from './realtimeService.js';
import { notifyUser } from './notificationService.js';
import { recordActivity } from './activityService.js';

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
    { path: 'assignedTo', select: 'name email avatar' },
    { path: 'createdBy', select: 'name email avatar' },
  ]);
  return task;
};

const labelsEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  const norm = (arr) => arr.map((l) => `${l.name}|${l.color}`).sort();
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
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

  await recordActivity({
    project: project._id,
    actor: actor._id,
    type: 'TASK_CREATED',
    summary: `${actor.name} created task "${task.title}"`,
    task: task._id,
    metadata: { status: task.status, priority: task.priority },
  });

  if (body.assignedTo && body.assignedTo !== actor._id.toString()) {
    await notifyUser({
      recipient: body.assignedTo,
      sender: actor._id,
      type: 'TASK_ASSIGNED',
      message: `${actor.name} assigned you the task "${task.title}"`,
      project: project._id,
      task: task._id,
    });
    await recordActivity({
      project: project._id,
      actor: actor._id,
      type: 'TASK_ASSIGNED',
      summary: `${actor.name} assigned "${task.title}"`,
      task: task._id,
      metadata: { assigneeId: body.assignedTo },
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
  const previousPriority = task.priority;
  const previousAssignee = task.assignedTo ? task.assignedTo.toString() : null;
  const previousDueDate = task.dueDate ? new Date(task.dueDate).toISOString() : null;
  const previousLabels = task.labels.map((l) => ({ name: l.name, color: l.color }));

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

  if (body.status && body.status !== previousStatus) {
    await recordActivity({
      project: project._id,
      actor: actor._id,
      type: 'TASK_STATUS_CHANGED',
      summary: `${actor.name} moved "${task.title}" to ${body.status}`,
      task: task._id,
      metadata: { from: previousStatus, to: body.status },
    });
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

  if (body.priority && body.priority !== previousPriority) {
    await recordActivity({
      project: project._id,
      actor: actor._id,
      type: 'TASK_PRIORITY_CHANGED',
      summary: `${actor.name} changed "${task.title}" priority from ${previousPriority} to ${body.priority}`,
      task: task._id,
      metadata: { from: previousPriority, to: body.priority },
    });
  }

  if (body.assignedTo !== undefined) {
    const newAssignee = body.assignedTo || null;
    const newId = newAssignee ? newAssignee.toString() : null;
    if (newId !== previousAssignee) {
      if (newId && newId !== actor._id.toString()) {
        await notifyUser({
          recipient: newId,
          sender: actor._id,
          type: 'TASK_ASSIGNED',
          message: `${actor.name} assigned you the task "${task.title}"`,
          project: project._id,
          task: task._id,
        });
        await recordActivity({
          project: project._id,
          actor: actor._id,
          type: 'TASK_ASSIGNED',
          summary: `${actor.name} assigned "${task.title}"`,
          task: task._id,
          metadata: { assigneeId: newId },
        });
      } else if (!newId && previousAssignee) {
        await recordActivity({
          project: project._id,
          actor: actor._id,
          type: 'TASK_UNASSIGNED',
          summary: `${actor.name} unassigned "${task.title}"`,
          task: task._id,
          metadata: { previousAssigneeId: previousAssignee },
        });
      }
    }
  }

  if (body.dueDate !== undefined) {
    const newDue = task.dueDate ? new Date(task.dueDate).toISOString() : null;
    if (newDue !== previousDueDate) {
      await recordActivity({
        project: project._id,
        actor: actor._id,
        type: 'TASK_DUE_DATE_CHANGED',
        summary: newDue
          ? `${actor.name} set due date for "${task.title}" to ${new Date(newDue).toLocaleDateString()}`
          : `${actor.name} removed due date from "${task.title}"`,
        task: task._id,
        metadata: { from: previousDueDate, to: newDue },
      });
    }
  }

  if (Array.isArray(body.labels) && !labelsEqual(previousLabels, body.labels)) {
    await recordActivity({
      project: project._id,
      actor: actor._id,
      type: 'TASK_LABELS_CHANGED',
      summary: `${actor.name} updated labels on "${task.title}"`,
      task: task._id,
      metadata: { count: body.labels.length },
    });
  }

  if (!body.status && !body.priority && body.assignedTo === undefined && body.dueDate === undefined && !Array.isArray(body.labels)) {
    await recordActivity({
      project: project._id,
      actor: actor._id,
      type: 'TASK_UPDATED',
      summary: `${actor.name} updated "${task.title}"`,
      task: task._id,
    });
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

  await recordActivity({
    project: project._id,
    actor: actor._id,
    type: 'TASK_ARCHIVED',
    summary: `${actor.name} archived "${task.title}"`,
    task: task._id,
  });

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

  await recordActivity({
    project: project._id,
    actor: actor._id,
    type: 'TASK_UNARCHIVED',
    summary: `${actor.name} restored "${task.title}" from archive`,
    task: task._id,
  });

  return updated;
};

const reorderTask = async ({ task, project, newStatus, newPosition, actor }) => {
  assertMember(project, actor._id);

  if (newStatus && !['Todo', 'In Progress', 'In Review', 'Done'].includes(newStatus)) {
    throw new AppError('Invalid status', 400);
  }

  const targetStatus = newStatus || task.status;
  const targetPosition = typeof newPosition === 'number' ? newPosition : task.position;
  const previousStatus = task.status;

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

  if (targetStatus !== previousStatus) {
    await recordActivity({
      project: project._id,
      actor: actor._id,
      type: 'TASK_STATUS_CHANGED',
      summary: `${actor.name} moved "${task.title}" to ${targetStatus}`,
      task: task._id,
      metadata: { from: previousStatus, to: targetStatus, via: 'drag-drop' },
    });
  }

  const allTasks = await Task.find({ project: project._id, status: targetStatus })
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar')
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

  await recordActivity({
    project: project._id,
    actor: actor._id,
    type: 'SUBTASK_CREATED',
    summary: `${actor.name} added subtask "${title.trim()}" to "${task.title}"`,
    task: task._id,
    metadata: { subtaskTitle: title.trim() },
  });

  return updated;
};

const toggleSubtask = async ({ task, project, subtaskId, done, actor }) => {
  assertMember(project, actor._id);
  const sub = task.subtasks.id(subtaskId);
  if (!sub) throw new AppError('Subtask not found', 404);

  const previousDone = sub.done;
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

  if (previousDone !== sub.done) {
    await recordActivity({
      project: project._id,
      actor: actor._id,
      type: 'SUBTASK_TOGGLED',
      summary: `${actor.name} ${sub.done ? 'completed' : 'unchecked'} subtask "${sub.title}" on "${task.title}"`,
      task: task._id,
      metadata: { subtaskId: sub._id, subtaskTitle: sub.title, done: sub.done },
    });
  }

  return updated;
};

const updateSubtask = async ({ task, project, subtaskId, title, actor }) => {
  assertMember(project, actor._id);
  const sub = task.subtasks.id(subtaskId);
  if (!sub) throw new AppError('Subtask not found', 404);
  const previousTitle = sub.title;
  if (title !== undefined) {
    if (!title.trim()) throw new AppError('Subtask title cannot be empty', 400);
    sub.title = title.trim();
  }
  await task.save();

  const updated = await buildTaskPayload(task);
  broadcastToProject(project._id, 'task:updated', updated);

  if (title !== undefined && title.trim() !== previousTitle) {
    await recordActivity({
      project: project._id,
      actor: actor._id,
      type: 'SUBTASK_UPDATED',
      summary: `${actor.name} renamed subtask on "${task.title}"`,
      task: task._id,
      metadata: { subtaskId: sub._id, from: previousTitle, to: title.trim() },
    });
  }

  return updated;
};

const deleteSubtask = async ({ task, project, subtaskId, actor }) => {
  assertMember(project, actor._id);
  const sub = task.subtasks.id(subtaskId);
  if (!sub) throw new AppError('Subtask not found', 404);
  const subtaskTitle = sub.title;
  sub.deleteOne();
  await task.save();

  const updated = await buildTaskPayload(task);
  broadcastToProject(project._id, 'task:updated', updated);

  await recordActivity({
    project: project._id,
    actor: actor._id,
    type: 'SUBTASK_DELETED',
    summary: `${actor.name} removed subtask "${subtaskTitle}" from "${task.title}"`,
    task: task._id,
    metadata: { subtaskTitle },
  });

  return updated;
};

const deleteTask = async ({ task, project, actor }) => {
  assertMember(project, actor._id);

  const projectId = project._id;
  const taskId = task._id;
  const taskTitle = task.title;

  const { default: Comment } = await import('../models/Comment.js');
  const { default: withTransaction } = await import('../utils/withTransaction.js');

  await withTransaction(async (session) => {
    await Comment.deleteMany({ task: taskId }, { session });
    await Task.deleteOne({ _id: taskId }, { session });
  });

  broadcastToProject(projectId, 'task:deleted', { taskId, projectId });

  await recordActivity({
    project: projectId,
    actor: actor._id,
    type: 'TASK_DELETED',
    summary: `${actor.name} deleted task "${taskTitle}"`,
    task: null,
    metadata: { taskTitle },
  });
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