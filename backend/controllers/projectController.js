import Project from '../models/Project.js';
import User from '../models/User.js';

const createProject = async (req, res, next) => {
  const { name, description } = req.body;

  try {
    const project = await Project.create({
      name,
      description,
      owner: req.user._id,
      members: [req.user._id],
    });

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};

const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({
      members: req.user._id,
    }).populate('owner', 'name email');

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

    const isMember = project.members.some(
      (member) => member._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
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
    project.description = description || project.description;

    const updatedProject = await project.save();
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

    await project.deleteOne();
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
      throw new Error('User not found');
    }

    const alreadyMember = project.members.includes(userToAdd._id);

    if (alreadyMember) {
      res.status(400);
      throw new Error('User is already a project member');
    }

    project.members.push(userToAdd._id);
    await project.save();

    res.json({ message: 'Member added successfully' });
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

    project.members = project.members.filter(
      (memberId) => memberId.toString() !== userId
    );

    await project.save();
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