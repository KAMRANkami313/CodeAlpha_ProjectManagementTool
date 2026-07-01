import { body, param } from 'express-validator';

const LABEL_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

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

const labelRules = body('labels')
  .optional()
  .isArray({ max: 20 })
  .withMessage('Labels must be an array of at most 20 items')
  .custom((labels = []) => {
    for (const l of labels) {
      if (typeof l?.name !== 'string' || !l.name.trim()) {
        throw new Error('Each label requires a name');
      }
      if (typeof l.color !== 'string' || !LABEL_COLOR_REGEX.test(l.color)) {
        throw new Error('Each label color must be a valid hex (e.g. #6366f1)');
      }
    }
    return true;
  });

const subtasksRules = body('subtasks')
  .optional()
  .isArray({ max: 100 })
  .withMessage('Subtasks must be an array of at most 100 items')
  .custom((subs = []) => {
    for (const s of subs) {
      if (typeof s?.title !== 'string' || !s.title.trim()) {
        throw new Error('Each subtask requires a title');
      }
    }
    return true;
  });

const taskRules = [
  body('title').trim().notEmpty().withMessage('Task title is required'),
  body('project').isMongoId().withMessage('A valid project id is required'),
  body('status').optional().isIn(['Todo', 'In Progress', 'In Review', 'Done']),
  body('priority').optional().isIn(['Low', 'Medium', 'High']),
  body('description').optional().isString().isLength({ max: 4000 }),
  body('dueDate').optional().isISO8601().toDate(),
  body('timeEstimateMinutes')
    .optional()
    .isInt({ min: 0, max: 525600 })
    .withMessage('Time estimate must be between 0 and 525600 minutes'),
  labelRules,
  subtasksRules,
];

const taskUpdateRules = [
  body('title').optional().trim().notEmpty().withMessage('Task title cannot be empty'),
  body('status').optional().isIn(['Todo', 'In Progress', 'In Review', 'Done']),
  body('priority').optional().isIn(['Low', 'Medium', 'High']),
  body('description').optional().isString().isLength({ max: 4000 }),
  body('dueDate').optional().isISO8601().toDate(),
  body('timeEstimateMinutes')
    .optional()
    .isInt({ min: 0, max: 525600 }),
  body('timeSpentMinutes')
    .optional()
    .isInt({ min: 0 }),
  labelRules,
];

const reorderRules = [
  body('status').optional().isIn(['Todo', 'In Progress', 'In Review', 'Done']),
  body('position').optional().isInt({ min: 0 }),
];

const subtaskCreateRules = [
  body('title').trim().notEmpty().withMessage('Subtask title is required'),
];

const subtaskToggleRules = [
  body('done').isBoolean().withMessage('done must be a boolean'),
];

const subtaskUpdateRules = [
  body('title').optional().trim().notEmpty().withMessage('Subtask title cannot be empty'),
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
  reorderRules,
  subtaskCreateRules,
  subtaskToggleRules,
  subtaskUpdateRules,
  commentRules,
  mongoIdParam,
};