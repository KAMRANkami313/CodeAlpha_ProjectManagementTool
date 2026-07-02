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

const ONLINE_THRESHOLD_MS = 90 * 1000;

const getClientMeta = (req) => ({
  userAgent: req.headers['user-agent'] || '',
  ip: req.ip || req.socket?.remoteAddress || '',
});

const buildAuthResponse = (user, tokenPair) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  bio: user.bio,
  preferences: user.preferences?.toObject?.() || user.preferences || {},
  accessToken: tokenPair.accessToken,
  refreshToken: tokenPair.refreshToken,
  refreshExpiresAt: tokenPair.refreshExpiresAt,
});

const buildProfileResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  bio: user.bio,
  preferences: user.preferences?.toObject?.() || user.preferences || {},
  lastLoginAt: user.lastLoginAt,
  lastSeenAt: user.lastSeenAt,
  isOnline: user.isOnline,
  tokenVersion: user.tokenVersion,
  createdAt: user.createdAt,
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
    user.lastSeenAt = new Date();
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
  user.lastSeenAt = new Date();
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
    avatar: result.user.avatar,
    bio: result.user.bio,
    preferences: result.user.preferences?.toObject?.() || result.user.preferences || {},
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    refreshExpiresAt: result.refreshExpiresAt,
  });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await revokeRefreshToken(refreshToken);
  if (req.user?.lastSeenAt !== undefined) {
    req.user.lastSeenAt = new Date();
    await req.user.save().catch(() => {});
  }
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

  res.json(buildProfileResponse(user));
});

const updateUserProfile = asyncHandler(async (req, res) => {
  const { name, bio, avatar, preferences } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (name !== undefined) {
    if (!name || !name.trim()) throw new AppError('Name cannot be empty', 400);
    user.name = name.trim();
  }
  if (bio !== undefined) {
    user.bio = typeof bio === 'string' ? bio.trim().slice(0, 300) : '';
  }
  if (avatar !== undefined) {
    user.avatar = typeof avatar === 'string' ? avatar.trim() : '';
  }
  if (preferences !== undefined && typeof preferences === 'object' && preferences !== null) {
    if (preferences.theme !== undefined) {
      if (!['system', 'light', 'dark'].includes(preferences.theme)) {
        throw new AppError('Invalid theme value', 400);
      }
      user.preferences = user.preferences || {};
      user.preferences.theme = preferences.theme;
    }
    if (preferences.emailNotifications !== undefined) {
      user.preferences.emailNotifications = Boolean(preferences.emailNotifications);
    }
    if (preferences.compactView !== undefined) {
      user.preferences.compactView = Boolean(preferences.compactView);
    }
  }

  await user.save();
  logger.info({ userId: user._id }, 'User profile updated');
  res.json(buildProfileResponse(user));
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 401);
  }

  const strength = scorePassword(newPassword);
  if (strength.score < 2) {
    throw new AppError(
      `New password is too weak. ${strength.suggestions.join(' ')}`,
      400,
      { strength }
    );
  }

  user.password = newPassword;
  await user.save();

  await revokeAllUserTokens(user._id);
  await bumpTokenVersion(user._id);

  logger.info({ userId: user._id }, 'User password changed');
  res.json({ message: 'Password changed. All sessions revoked — please log in again.' });
});

const searchUsersByEmail = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim().length < 3) {
    return res.json([]);
  }

  const users = await User.find({
    email: { $regex: query.trim(), $options: 'i' },
  })
    .select('name email avatar lastSeenAt')
    .limit(5);

  const now = Date.now();
  const result = users.map((u) => {
    const obj = u.toObject({ virtuals: true });
    obj.isOnline = u.lastSeenAt ? now - u.lastSeenAt.getTime() < ONLINE_THRESHOLD_MS : false;
    return obj;
  });

  res.json(result);
});

const touchPresence = asyncHandler(async (req, res) => {
  await req.user.touchPresence();
  res.json({ ok: true, lastSeenAt: req.user.lastSeenAt });
});

export {
  registerUser,
  authUser,
  refreshAccessToken,
  logout,
  logoutAll,
  getUserProfile,
  updateUserProfile,
  changePassword,
  searchUsersByEmail,
  touchPresence,
};