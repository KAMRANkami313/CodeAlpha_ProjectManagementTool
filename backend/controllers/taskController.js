import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Comment from '../models/Comment.js';
import { containsId } from '../utils/idHelpers.js';
import { broadcastToProject } from '../services/realtimeService.js';
import { notifyUser } from '../services/notificationService.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import withTransaction from '../utils/withTransaction.js';
import {
  createTask as createTaskService,
  updateTask as updateTaskService,
  archiveTask as archiveTaskService,
  unarchiveTask as unarchiveTaskService,
  reorderTask as reorderTaskService,
  addSubtask as addSubtaskService,
  toggleSubtask as toggleSubtaskService,
  updateSubtask as updateSubtaskService,
  deleteSubtask as deleteSubtaskService,
  deleteTask as deleteTaskService,
} from '../services/taskService.js';

const ensureProjectMember = (project, userId) => {
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  if (!containsId(project.members, userId)) {
    throw new AppError('Access denied to this project', 403);
  }
};

const loadTaskWithProject = async (taskId) => {
  const task = await Task.findById(taskId).populate('project', 'members name _id');
  if (!task) throw new AppError('Task not found', 404);
  return task;
};

const createTask = asyncHandler(async (req, res) => {
  const { project: projectId, ...rest } = req.body;
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);

  const created = await createTaskService({
    project,
    body: { ...rest, project: projectId },
    actor: req.user,
  });

  res.status(201).json(created);
});

const getProjectTasks = asyncHandler(async (req, res) => {
  const parentProject = await Project.findById(req.params.projectId);
  ensureProjectMember(parentProject, req.user._id);

  const includeArchived = req.query.includeArchived === 'true';
  const filter = { project: req.params.projectId };
  if (!includeArchived) filter.isArchived = { $ne: true };

  const tasks = await Task.find(filter)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .sort({ position: 1, createdAt: 1 });

  res.json(tasks);
});

const getTaskById = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .populate('project', 'name members');

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  if (!containsId(task.project.members, req.user._id)) {
    throw new AppError('Access denied to this task', 403);
  }

  res.json(task);
});

const updateTask = asyncHandler(async (req, res) => {
  const task = await loadTaskWithProject(req.params.id);
  const updated = await updateTaskService({
    task,
    project: task.project,
    body: req.body,
    actor: req.user,
  });
  res.json(updated);
});

const reorderTask = asyncHandler(async (req, res) => {
  const { status, position } = req.body;
  const task = await loadTaskWithProject(req.params.id);
  const updated = await reorderTaskService({
    task,
    project: task.project,
    newStatus: status,
    newPosition: position,
    actor: req.user,
  });
  res.json(updated);
});

const archiveTask = asyncHandler(async (req, res) => {
  const task = await loadTaskWithProject(req.params.id);
  const updated = await archiveTaskService({ task, project: task.project, actor: req.user });
  res.json(updated);
});

const unarchiveTask = asyncHandler(async (req, res) => {
  const task = await loadTaskWithProject(req.params.id);
  const updated = await unarchiveTaskService({ task, project: task.project, actor: req.user });
  res.json(updated);
});

const deleteTask = asyncHandler(async (req, res) => {
  const task = await loadTaskWithProject(req.params.id);
  await deleteTaskService({ task, project: task.project, actor: req.user });
  res.json({ message: 'Task and comments removed' });
});

const addSubtask = asyncHandler(async (req, res) => {
  const { title } = req.body;
  const task = await loadTaskWithProject(req.params.id);
  const updated = await addSubtaskService({ task, project: task.project, title, actor: req.user });
  res.status(201).json(updated);
});

const toggleSubtask = asyncHandler(async (req, res) => {
  const { done } = req.body;
  const task = await loadTaskWithProject(req.params.id);
  const updated = await toggleSubtaskService({
    task,
    project: task.project,
    subtaskId: req.params.subtaskId,
    done,
    actor: req.user,
  });
  res.json(updated);
});

const updateSubtask = asyncHandler(async (req, res) => {
  const { title } = req.body;
  const task = await loadTaskWithProject(req.params.id);
  const updated = await updateSubtaskService({
    task,
    project: task.project,
    subtaskId: req.params.subtaskId,
    title,
    actor: req.user,
  });
  res.json(updated);
});

const deleteSubtask = asyncHandler(async (req, res) => {
  const task = await loadTaskWithProject(req.params.id);
  await deleteSubtaskService({
    task,
    project: task.project,
    subtaskId: req.params.subtaskId,
    actor: req.user,
  });
  res.json({ message: 'Subtask removed' });
});

const addTaskComment = asyncHandler(async (req, res) => {
  const { content } = req.body;

  const task = await Task.findById(req.params.id).populate('project', 'members name');

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  if (!containsId(task.project.members, req.user._id)) {
    throw new AppError('Access denied to comment on this task', 403);
  }

  const comment = await Comment.create({
    content,
    task: req.params.id,
    user: req.user._id,
  });

  const populatedComment = await Comment.findById(comment._id).populate('user', 'name email');

  broadcastToProject(task.project._id, 'comment:created', {
    taskId: task._id,
    comment: populatedComment,
  });

  const watchers = new Set();
  if (task.assignedTo) watchers.add(task.assignedTo.toString());
  if (task.createdBy) watchers.add(task.createdBy.toString());
  watchers.delete(req.user._id.toString());

  await Promise.all(
    [...watchers].map((recipient) =>
      notifyUser({
        recipient,
        sender: req.user._id,
        type: 'TASK_COMMENT',
        message: `${req.user.name} commented on "${task.title}"`,
        project: task.project._id,
        task: task._id,
      })
    )
  );

  res.status(201).json(populatedComment);
});

const getTaskComments = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id).populate('project', 'members');

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  if (!containsId(task.project.members, req.user._id)) {
    throw new AppError('Access denied to view comments', 403);
  }

  const comments = await Comment.find({ task: req.params.id })
    .populate('user', 'name email')
    .sort({ createdAt: 1 });

  res.json(comments);
});

export {
  createTask,
  getProjectTasks,
  getTaskById,
  updateTask,
  reorderTask,
  archiveTask,
  unarchiveTask,
  deleteTask,
  addSubtask,
  toggleSubtask,
  updateSubtask,
  deleteSubtask,
  addTaskComment,
  getTaskComments,
};