import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import {
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  bumpTokenVersion,
} from '../services/authService.js';
import { scorePassword } from '../utils/passwordStrength.js';

const getClientMeta = (req) => ({
  userAgent: req.headers['user-agent'] || '',
  ip: req.ip || req.socket?.remoteAddress || '',
});

const buildAuthResponse = (user, tokenPair) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  accessToken: tokenPair.accessToken,
  refreshToken: tokenPair.refreshToken,
  refreshExpiresAt: tokenPair.refreshExpiresAt,
});

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const strength = scorePassword(password);
  if (strength.score < 2) {
    throw new AppError(
      `Password is too weak. ${strength.suggestions.join(' ')}`,
      400,
      { strength }
    );
  }

  try {
    const user = await User.create({ name, email, password });
    const tokenPair = await issueTokenPair(user, getClientMeta(req));
    user.lastLoginAt = new Date();
    await user.save();

    logger.info({ userId: user._id }, 'User registered');
    res.status(201).json(buildAuthResponse(user, tokenPair));
  } catch (error) {
    if (error?.code === 11000 || error?.message?.includes('E11000')) {
      throw new AppError('Email already registered', 409);
    }
    throw error;
  }
});

const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select(
    '+password +failedLoginAttempts +lockUntil'
  );

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  if (user.isLocked) {
    const remainingMs = user.lockUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new AppError(
      `Account temporarily locked. Try again in ${remainingMin} minute${remainingMin === 1 ? '' : 's'}`,
      423
    );
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    await user.incLoginAttempts();
    throw new AppError('Invalid email or password', 401);
  }

  await user.resetLoginAttempts();
  user.lastLoginAt = new Date();
  await user.save();

  const tokenPair = await issueTokenPair(user, getClientMeta(req));

  logger.info({ userId: user._id }, 'User logged in');
  res.json(buildAuthResponse(user, tokenPair));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await rotateRefreshToken(refreshToken, getClientMeta(req));

  res.json({
    _id: result.user._id,
    name: result.user.name,
    email: result.user.email,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    refreshExpiresAt: result.refreshExpiresAt,
  });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await revokeRefreshToken(refreshToken);
  logger.info({ userId: req.user._id }, 'User logged out');
  res.json({ message: 'Logged out' });
});

const logoutAll = asyncHandler(async (req, res) => {
  await revokeAllUserTokens(req.user._id);
  await bumpTokenVersion(req.user._id);
  logger.info({ userId: req.user._id }, 'User logged out of all devices');
  res.json({ message: 'Logged out of all devices' });
});

const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    lastLoginAt: user.lastLoginAt,
    tokenVersion: user.tokenVersion,
  });
});

const searchUsersByEmail = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim().length < 3) {
    return res.json([]);
  }

  const users = await User.find({
    email: { $regex: query.trim(), $options: 'i' },
  })
    .select('name email')
    .limit(5);

  res.json(users);
});

export {
  registerUser,
  authUser,
  refreshAccessToken,
  logout,
  logoutAll,
  getUserProfile,
  searchUsersByEmail,
};