import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Comment from '../models/Comment.js';

const createTask = async (req, res, next) => {
  const { title, description, status, priority, project, assignedTo, dueDate } = req.body;

  try {
    const parentProject = await Project.findById(project);

    if (!parentProject) {
      res.status(404);
      throw new Error('Project not found');
    }

    const isMember = parentProject.members.includes(req.user._id);

    if (!isMember) {
      res.status(403);
      throw new Error('Access denied to this project');
    }

    const task = await Task.create({
      title,
      description,
      status,
      priority,
      project,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

const getProjectTasks = async (req, res, next) => {
  try {
    const parentProject = await Project.findById(req.params.projectId);

    if (!parentProject) {
      res.status(404);
      throw new Error('Project not found');
    }

    const isMember = parentProject.members.includes(req.user._id);

    if (!isMember) {
      res.status(403);
      throw new Error('Access denied to this project');
    }

    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignedTo', 'name email');

    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('project', 'name members');

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    const isMember = task.project.members.includes(req.user._id);

    if (!isMember) {
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
    const task = await Task.findById(req.params.id).populate('project', 'members');

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    const isMember = task.project.members.includes(req.user._id);

    if (!isMember) {
      res.status(403);
      throw new Error('Access denied to modify this task');
    }

    task.title = title || task.title;
    task.description = description !== undefined ? description : task.description;
    task.status = status || task.status;
    task.priority = priority || task.priority;
    task.assignedTo = assignedTo !== undefined ? assignedTo : task.assignedTo;
    task.dueDate = dueDate !== undefined ? dueDate : task.dueDate;

    const updatedTask = await task.save();
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

    const isMember = task.project.members.includes(req.user._id);

    if (!isMember) {
      res.status(403);
      throw new Error('Access denied to delete this task');
    }

    await Comment.deleteMany({ task: task._id });
    await task.deleteOne();

    res.json({ message: 'Task and comments removed' });
  } catch (error) {
    next(error);
  }
};

const addTaskComment = async (req, res, next) => {
  const { content } = req.body;

  try {
    const task = await Task.findById(req.params.id).populate('project', 'members');

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    const isMember = task.project.members.includes(req.user._id);

    if (!isMember) {
      res.status(403);
      throw new Error('Access denied to comment on this task');
    }

    const comment = await Comment.create({
      content,
      task: req.params.id,
      user: req.user._id,
    });

    const populatedComment = await Comment.findById(comment._id).populate('user', 'name email');

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

    const isMember = task.project.members.includes(req.user._id);

    if (!isMember) {
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