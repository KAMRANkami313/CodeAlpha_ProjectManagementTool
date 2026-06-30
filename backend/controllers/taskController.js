import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Comment from '../models/Comment.js';
import { containsId } from '../utils/idHelpers.js';
import { broadcastToProject } from '../services/realtimeService.js';
import { notifyUser } from '../services/notificationService.js';

const ensureProjectMember = (project, userId) => {
  if (!project) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }
  if (!containsId(project.members, userId)) {
    const err = new Error('Access denied to this project');
    err.status = 403;
    throw err;
  }
};

const createTask = async (req, res, next) => {
  const { title, description, status, priority, project, assignedTo, dueDate } = req.body;

  try {
    const parentProject = await Project.findById(project);

    if (!parentProject) {
      res.status(404);
      throw new Error('Project not found');
    }

    if (!containsId(parentProject.members, req.user._id)) {
      res.status(403);
      throw new Error('Access denied to this project');
    }

    if (assignedTo && !containsId(parentProject.members, assignedTo)) {
      res.status(400);
      throw new Error('Cannot assign task to a non-member of this project');
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
  } catch (error) {
    next(error);
  }
};

const getProjectTasks = async (req, res, next) => {
  try {
    const parentProject = await Project.findById(req.params.projectId);
    ensureProjectMember(parentProject, req.user._id);

    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ position: 1, createdAt: 1 });

    res.json(tasks);
  } catch (error) {
    if (error.status) res.status(error.status);
    next(error);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name members');

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    if (!containsId(task.project.members, req.user._id)) {
      res.status(403);
      throw new Error('Access denied to this task');
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  const { title, description, status, priority, assignedTo, dueDate } = req.body;

  try {
    const task = await Task.findById(req.params.id).populate('project', 'members name');

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    if (!containsId(task.project.members, req.user._id)) {
      res.status(403);
      throw new Error('Access denied to modify this task');
    }

    if (assignedTo !== undefined && assignedTo !== null && !containsId(task.project.members, assignedTo)) {
      res.status(400);
      throw new Error('Cannot assign task to a non-member of this project');
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
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('project', 'members');

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    if (!containsId(task.project.members, req.user._id)) {
      res.status(403);
      throw new Error('Access denied to delete this task');
    }

    await Comment.deleteMany({ task: task._id });
    const projectId = task.project._id;
    const taskId = task._id;
    await task.deleteOne();

    broadcastToProject(projectId, 'task:deleted', { taskId, projectId });

    res.json({ message: 'Task and comments removed' });
  } catch (error) {
    next(error);
  }
};

const addTaskComment = async (req, res, next) => {
  const { content } = req.body;

  try {
    const task = await Task.findById(req.params.id).populate('project', 'members name');

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    if (!containsId(task.project.members, req.user._id)) {
      res.status(403);
      throw new Error('Access denied to comment on this task');
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
  } catch (error) {
    next(error);
  }
};

const getTaskComments = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('project', 'members');

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    if (!containsId(task.project.members, req.user._id)) {
      res.status(403);
      throw new Error('Access denied to view comments');
    }

    const comments = await Comment.find({ task: req.params.id })
      .populate('user', 'name email')
      .sort({ createdAt: 1 });

    res.json(comments);
  } catch (error) {
    next(error);
  }
};

export {
  createTask,
  getProjectTasks,
  getTaskById,
  updateTask,
  deleteTask,
  addTaskComment,
  getTaskComments,
};
