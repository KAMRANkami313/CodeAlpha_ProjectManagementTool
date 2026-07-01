import { body, param } from 'express-validator';

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

const loginRules = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const refreshTokenRules = [
  body('refreshToken')
    .isString()
    .notEmpty()
    .withMessage('Refresh token is required'),
];

const logoutRules = [
  body('refreshToken')
    .optional()
    .isString()
    .withMessage('Refresh token must be a string'),
];

const projectRules = [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('description').optional().trim(),
];

const addMemberRules = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
];

const taskRules = [
  body('title').trim().notEmpty().withMessage('Task title is required'),
  body('project').isMongoId().withMessage('A valid project id is required'),
  body('status').optional().isIn(['Todo', 'In Progress', 'In Review', 'Done']),
  body('priority').optional().isIn(['Low', 'Medium', 'High']),
];

const taskUpdateRules = [
  body('title').optional().trim().notEmpty().withMessage('Task title cannot be empty'),
  body('status').optional().isIn(['Todo', 'In Progress', 'In Review', 'Done']),
  body('priority').optional().isIn(['Low', 'Medium', 'High']),
];

const commentRules = [
  body('content').trim().notEmpty().withMessage('Comment content is required'),
];

const mongoIdParam = (field) => [param(field).isMongoId().withMessage('Invalid id')];

export {
  registerRules,
  loginRules,
  refreshTokenRules,
  logoutRules,
  projectRules,
  addMemberRules,
  taskRules,
  taskUpdateRules,
  commentRules,
  mongoIdParam,
};
