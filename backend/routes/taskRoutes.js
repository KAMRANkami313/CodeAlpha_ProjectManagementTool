import express from 'express';
import {
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
} from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  taskRules,
  taskUpdateRules,
  taskQueryRules,
  reorderRules,
  subtaskCreateRules,
  subtaskToggleRules,
  subtaskUpdateRules,
  commentRules,
  mongoIdParam,
} from '../validators/rules.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .post(taskRules, validate, createTask);

router.route('/project/:projectId')
  .get(mongoIdParam('projectId'), taskQueryRules, validate, getProjectTasks);

router.route('/:id')
  .get(mongoIdParam('id'), validate, getTaskById)
  .put(mongoIdParam('id'), taskUpdateRules, validate, updateTask)
  .delete(mongoIdParam('id'), validate, deleteTask);

router.route('/:id/reorder')
  .put(mongoIdParam('id'), reorderRules, validate, reorderTask);

router.route('/:id/archive')
  .put(mongoIdParam('id'), validate, archiveTask);

router.route('/:id/unarchive')
  .put(mongoIdParam('id'), validate, unarchiveTask);

router.route('/:id/subtasks')
  .post(mongoIdParam('id'), subtaskCreateRules, validate, addSubtask);

router.route('/:id/subtasks/:subtaskId')
  .put(mongoIdParam('id'), mongoIdParam('subtaskId'), subtaskUpdateRules, validate, updateSubtask)
  .patch(mongoIdParam('id'), mongoIdParam('subtaskId'), subtaskToggleRules, validate, toggleSubtask)
  .delete(mongoIdParam('id'), mongoIdParam('subtaskId'), validate, deleteSubtask);

router.route('/:id/comments')
  .post(mongoIdParam('id'), commentRules, validate, addTaskComment)
  .get(mongoIdParam('id'), validate, getTaskComments);

export default router;