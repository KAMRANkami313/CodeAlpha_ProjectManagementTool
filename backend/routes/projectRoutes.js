import express from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  getProjectActivity,
} from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { projectRules, addMemberRules, mongoIdParam } from '../validators/rules.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .post(projectRules, validate, createProject)
  .get(getProjects);

router.route('/:id')
  .get(mongoIdParam('id'), validate, getProjectById)
  .put(mongoIdParam('id'), projectRules, validate, updateProject)
  .delete(mongoIdParam('id'), validate, deleteProject);

router.get('/:id/activity', mongoIdParam('id'), validate, getProjectActivity);

router.post('/:id/members', mongoIdParam('id'), addMemberRules, validate, addProjectMember);
router.delete('/:id/members/:userId', mongoIdParam('id'), mongoIdParam('userId'), validate, removeProjectMember);

export default router;