import express from 'express';
import {
  createTask,
  getProjectTasks,
  getTaskById,
  updateTask,
  deleteTask,
  addTaskComment,
  getTaskComments,
} from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { taskRules, taskUpdateRules, commentRules, mongoIdParam } from '../validators/rules.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .post(taskRules, validate, createTask);

router.route('/project/:projectId')
  .get(mongoIdParam('projectId'), validate, getProjectTasks);

router.route('/:id')
  .get(mongoIdParam('id'), validate, getTaskById)
  .put(mongoIdParam('id'), taskUpdateRules, validate, updateTask)
  .delete(mongoIdParam('id'), validate, deleteTask);

router.route('/:id/comments')
  .post(mongoIdParam('id'), commentRules, validate, addTaskComment)
  .get(mongoIdParam('id'), validate, getTaskComments);

export default router;
