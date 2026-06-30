import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { containsId, removeId } from '../utils/idHelpers.js';
import { broadcastToProject } from '../services/realtimeService.js';
import { notifyUser } from '../services/notificationService.js';

const createProject = async (req, res, next) => {
  const { name, description } = req.body;

  try {
    const project = await Project.create({
      name,
      description,
      owner: req.user._id,
      members: [req.user._id],
    });

    const populated = await project.populate('owner', 'name email');

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({
      members: req.user._id,
    })
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members', 'name email');

    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    if (!containsId(project.members.map((m) => m._id), req.user._id)) {
      res.status(403);
      throw new Error('Access denied');
    }

    res.json(project);
  } catch (error) {
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  const { name, description } = req.body;

  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized as project owner');
    }

    project.name = name || project.name;
    project.description = description !== undefined ? description : project.description;

    const updatedProject = await project.save();

    broadcastToProject(project._id, 'project:updated', updatedProject);

    res.json(updatedProject);
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized as project owner');
    }

    const tasks = await Task.find({ project: project._id }).select('_id');
    const taskIds = tasks.map((t) => t._id);

    await Comment.deleteMany({ task: { $in: taskIds } });
    await Task.deleteMany({ project: project._id });
    await project.deleteOne();

    broadcastToProject(project._id, 'project:deleted', { projectId: project._id });

    res.json({ message: 'Project removed' });
  } catch (error) {
    next(error);
  }
};

const addProjectMember = async (req, res, next) => {
  const { email } = req.body;

  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized as project owner');
    }

    const userToAdd = await User.findOne({ email });

    if (!userToAdd) {
      res.status(404);
      throw new Error('No user found with that email');
    }

    if (containsId(project.members, userToAdd._id)) {
      res.status(400);
      throw new Error('User is already a project member');
    }

    project.members.push(userToAdd._id);
    await project.save();

    const populatedProject = await project.populate('members', 'name email');

    broadcastToProject(project._id, 'project:memberAdded', {
      projectId: project._id,
      member: { _id: userToAdd._id, name: userToAdd.name, email: userToAdd.email },
    });

    await notifyUser({
      recipient: userToAdd._id,
      sender: req.user._id,
      type: 'PROJECT_MEMBER_ADDED',
      message: `${req.user.name} added you to the project "${project.name}"`,
      project: project._id,
    });

    res.json(populatedProject);
  } catch (error) {
    next(error);
  }
};

const removeProjectMember = async (req, res, next) => {
  const { userId } = req.body;

  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized as project owner');
    }

    if (userId === project.owner.toString()) {
      res.status(400);
      throw new Error('Cannot remove the project owner');
    }

    project.members = removeId(project.members, userId);
    await project.save();

    broadcastToProject(project._id, 'project:memberRemoved', {
      projectId: project._id,
      userId,
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
};

export {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
};
