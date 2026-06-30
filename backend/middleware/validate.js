import { validationResult } from 'express-validator';

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorList = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return res.status(400).json({
      message: 'Validation failed',
      errors: errorList,
    });
  }

  next();
};

export { validate };
