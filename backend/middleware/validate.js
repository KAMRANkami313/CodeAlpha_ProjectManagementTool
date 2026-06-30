import { validationResult } from 'express-validator';

/**
 * Runs after an array of express-validator checks. Collects errors into
 * a single 400 response instead of every controller reimplementing this.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    return next(new Error(errors.array()[0].msg));
  }
  next();
};

export { validate };
