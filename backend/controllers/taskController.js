import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Comment from '../models/Comment.js';
import { containsId } from '../utils/idHelpers.js';
import { broadcastToProject } from '../services/realtimeService.js';
import { notifyUser } from '../services/notificationService.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import withTransaction from '../utils/withTransaction.js';

const ensureProjectMember = (project, userId) => {
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  if (!containsId(project.members, userId)) {
    throw new AppError('Access denied to this project', 403);
  }
};

const createTask = asyncHandler(async (req, res) => {
  const { title, description, status, priority, project, assignedTo, dueDate } = req.body;

  const parentProject = await Project.findById(project);

  if (!parentProject) {
    throw new AppError('Project not found', 404);
  }

  if (!containsId(parentProject.members, req.user._id)) {
    throw new AppError('Access denied to this project', 403);
  }

  if (assignedTo && !containsId(parentProject.members, assignedTo)) {
    throw new AppError('Cannot assign task to a non-member of this project', 400);
  }

  const task = await Task.create({
    title,
    description,
    status,
    priority,
    project,
    assignedTo: assignedTo || null,
    dueDate: dueDate || null,
    createdBy: req.user._id,
  });

  const populatedTask = await task.populate('assignedTo', 'name email');

  broadcastToProject(project, 'task:created', populatedTask);

  if (assignedTo) {
    await notifyUser({
      recipient: assignedTo,
      sender: req.user._id,
      type: 'TASK_ASSIGNED',
      message: `${req.user.name} assigned you the task "${task.title}"`,
      project,
      task: task._id,
    });
  }

  res.status(201).json(populatedTask);
});

const getProjectTasks = asyncHandler(async (req, res) => {
  const parentProject = await Project.findById(req.params.projectId);
  ensureProjectMember(parentProject, req.user._id);

  const tasks = await Task.find({ project: req.params.projectId })
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
  const { title, description, status, priority, assignedTo, dueDate } = req.body;

  const task = await Task.findById(req.params.id).populate('project', 'members name');

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  if (!containsId(task.project.members, req.user._id)) {
    throw new AppError('Access denied to modify this task', 403);
  }

  if (assignedTo !== undefined && assignedTo !== null && !containsId(task.project.members, assignedTo)) {
    throw new AppError('Cannot assign task to a non-member of this project', 400);
  }

  const previousStatus = task.status;
  const previousAssignee = task.assignedTo ? task.assignedTo.toString() : null;

  task.title = title !== undefined ? title : task.title;
  task.description = description !== undefined ? description : task.description;
  task.status = status || task.status;
  task.priority = priority || task.priority;
  task.assignedTo = assignedTo !== undefined ? assignedTo : task.assignedTo;
  task.dueDate = dueDate !== undefined ? dueDate : task.dueDate;

  await task.save();
  const updatedTask = await task.populate('assignedTo', 'name email');

  broadcastToProject(task.project._id, 'task:updated', updatedTask);

  if (assignedTo && assignedTo !== previousAssignee) {
    await notifyUser({
      recipient: assignedTo,
      sender: req.user._id,
      type: 'TASK_ASSIGNED',
      message: `${req.user.name} assigned you the task "${task.title}"`,
      project: task.project._id,
      task: task._id,
    });
  }

  if (status && status !== previousStatus && task.assignedTo) {
    await notifyUser({
      recipient: task.assignedTo,
      sender: req.user._id,
      type: 'TASK_STATUS_CHANGED',
      message: `${req.user.name} moved "${task.title}" to ${status}`,
      project: task.project._id,
      task: task._id,
    });
  }

  res.json(updatedTask);
});

const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id).populate('project', 'members');

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  if (!containsId(task.project.members, req.user._id)) {
    throw new AppError('Access denied to delete this task', 403);
  }

  const projectId = task.project._id;
  const taskId = task._id;

  await withTransaction(async (session) => {
    await Comment.deleteMany({ task: taskId }, { session });
    await Task.deleteOne({ _id: taskId }, { session });
  });

  broadcastToProject(projectId, 'task:deleted', { taskId, projectId });

  res.json({ message: 'Task and comments removed' });
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
  deleteTask,
  addTaskComment,
  getTaskComments,
};
