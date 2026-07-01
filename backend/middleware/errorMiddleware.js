import logger from '../utils/logger.js';
import env from '../config/env.js';

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  error.isOperational = true;
  next(error);
};

const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || 'Internal Server Error';
  let isOperational = err.isOperational === true;

  // Normalize common Mongoose / JWT errors into clean 4xx responses
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
    isOperational = true;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `Duplicate value for "${field}"` : 'Duplicate field value entered';
    isOperational = true;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    message = messages.length ? messages.join(', ') : 'Validation failed';
    isOperational = true;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    isOperational = true;
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired, please log in again';
    isOperational = true;
  }

  // In production, hide the details of programmer errors (5xx non-operational)
  if (env.isProduction && !isOperational && statusCode >= 500) {
    message = 'Something went wrong';
  }

  // Logging strategy:
  //  - 4xx operational errors → warn (expected, but worth tracking)
  //  - 5xx / programmer errors → error (with full stack)
  const logPayload = {
    err,
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?._id?.toString(),
    statusCode,
  };

  if (statusCode >= 500) {
    logger.error(logPayload, message);
  } else if (statusCode >= 400) {
    logger.warn(logPayload, message);
  }

  res.status(statusCode).json({
    message,
    requestId: req.id,
    ...(env.isProduction ? {} : { stack: err.stack }),
    ...(err.details ? { details: err.details } : {}),
  });
};

export { notFound, errorHandler };