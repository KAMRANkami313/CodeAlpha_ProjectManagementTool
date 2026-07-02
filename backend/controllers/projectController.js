import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import { containsId, removeId } from '../utils/idHelpers.js';
import { broadcastToProject } from '../services/realtimeService.js';
import { notifyUser } from '../services/notificationService.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import withTransaction from '../utils/withTransaction.js';
import { parsePagination, isPaginated, buildPaginationMeta } from '../utils/pagination.js';
import { recordActivity } from '../services/activityService.js';

const ensureProjectOwner = (project, userId) => {
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  if (project.owner.toString() !== userId.toString()) {
    throw new AppError('Not authorized as project owner', 403);
  }
};

const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const project = await Project.create({
    name,
    description,
    owner: req.user._id,
    members: [req.user._id],
  });

  const populated = await project.populate('owner', 'name email avatar');

  await recordActivity({
    project: project._id,
    actor: req.user._id,
    type: 'PROJECT_CREATED',
    summary: `${req.user.name} created project "${project.name}"`,
  });

  res.status(201).json(populated);
});

const getProjects = asyncHandler(async (req, res) => {
  const filter = { members: req.user._id };

  if (isPaginated(req)) {
    const { page, limit, skip } = parsePagination(req);
    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate('owner', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Project.countDocuments(filter),
    ]);
    return res.json({ data: projects, pagination: buildPaginationMeta(page, limit, total) });
  }

  const projects = await Project.find(filter)
    .populate('owner', 'name email avatar')
    .sort({ createdAt: -1 });

  res.json(projects);
});

const getProjectById = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('owner', 'name email avatar')
    .populate('members', 'name email avatar');

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (!containsId(project.members.map((m) => m._id), req.user._id)) {
    throw new AppError('Access denied', 403);
  }

  res.json(project);
});

const updateProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const project = await Project.findById(req.params.id);

  ensureProjectOwner(project, req.user._id);

  project.name = name || project.name;
  project.description = description !== undefined ? description : project.description;

  const updatedProject = await project.save();

  broadcastToProject(project._id, 'project:updated', updatedProject);

  await recordActivity({
    project: project._id,
    actor: req.user._id,
    type: 'PROJECT_UPDATED',
    summary: `${req.user.name} updated project details`,
    metadata: { name, description: Boolean(description) },
  });

  res.json(updatedProject);
});

const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  ensureProjectOwner(project, req.user._id);

  const projectId = project._id;

  await withTransaction(async (session) => {
    const tasks = await Task.find({ project: projectId }).select('_id');
    const taskIds = tasks.map((t) => t._id);

    if (taskIds.length > 0) {
      await Comment.deleteMany({ task: { $in: taskIds } }, { session });
    }
    await Task.deleteMany({ project: projectId }, { session });
    await Project.deleteOne({ _id: projectId }, { session });
  });

  broadcastToProject(projectId, 'project:deleted', { projectId });

  await recordActivity({
    project: projectId,
    actor: req.user._id,
    type: 'PROJECT_DELETED',
    summary: `${req.user.name} deleted project "${project.name}"`,
    metadata: { projectName: project.name },
    emit: false,
  });

  res.json({ message: 'Project removed' });
});

const addProjectMember = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const project = await Project.findById(req.params.id);

  ensureProjectOwner(project, req.user._id);

  const userToAdd = await User.findOne({ email });

  if (!userToAdd) {
    throw new AppError('No user found with that email', 404);
  }

  if (containsId(project.members, userToAdd._id)) {
    throw new AppError('User is already a project member', 400);
  }

  project.members.push(userToAdd._id);
  await project.save();

  const populatedProject = await project.populate('members', 'name email avatar');

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

  await recordActivity({
    project: project._id,
    actor: req.user._id,
    type: 'PROJECT_MEMBER_ADDED',
    summary: `${req.user.name} added ${userToAdd.name} to the project`,
    metadata: { memberId: userToAdd._id, memberName: userToAdd.name },
  });

  res.json(populatedProject);
});

const removeProjectMember = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const project = await Project.findById(req.params.id);

  ensureProjectOwner(project, req.user._id);

  if (userId === project.owner.toString()) {
    throw new AppError('Cannot remove the project owner', 400);
  }

  if (!containsId(project.members, userId)) {
    throw new AppError('User is not a member of this project', 400);
  }

  project.members = removeId(project.members, userId);
  await project.save();

  broadcastToProject(project._id, 'project:memberRemoved', {
    projectId: project._id,
    userId,
  });

  await recordActivity({
    project: project._id,
    actor: req.user._id,
    type: 'PROJECT_MEMBER_REMOVED',
    summary: `${req.user.name} removed a member from the project`,
    metadata: { memberId: userId },
  });

  res.json({ message: 'Member removed successfully' });
});

const getProjectActivity = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (!containsId(project.members, req.user._id)) {
    throw new AppError('Access denied', 403);
  }

  const filter = { project: project._id };
  if (req.query.type) {
    const types = String(req.query.type).split(',').map((t) => t.trim()).filter(Boolean);
    if (types.length > 0) filter.type = { $in: types };
  }
  if (req.query.task) {
    filter.task = req.query.task;
  }
  if (req.query.actor) {
    filter.actor = req.query.actor;
  }

  const { page, limit, skip } = parsePagination(req);
  const [activities, total] = await Promise.all([
    Activity.find(filter)
      .populate('actor', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Activity.countDocuments(filter),
  ]);

  res.json({
    data: activities,
    pagination: buildPaginationMeta(page, limit, total),
  });
});

export {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  getProjectActivity,
};