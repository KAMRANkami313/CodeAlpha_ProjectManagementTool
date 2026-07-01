import User from '../models/User.js';
import { verifyAccessToken } from '../utils/generateToken.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Not authorized, no token', 401);
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Access token expired', 401);
    }
    throw new AppError('Not authorized, token failed', 401);
  }

  if (decoded.type !== 'access') {
    throw new AppError('Invalid token type', 401);
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    throw new AppError('Not authorized, user no longer exists', 401);
  }

  if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
    throw new AppError('Session invalidated, please log in again', 401);
  }

  req.user = user;
  next();
});

export { protect };
