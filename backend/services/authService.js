import RefreshToken from '../models/RefreshToken.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import {
  generateAccessToken,
  generateRefreshTokenValue,
  hashRefreshToken,
  REFRESH_TOKEN_EXPIRES_SECONDS,
} from '../utils/generateToken.js';

const buildTokenPair = (user) => {
  const accessToken = generateAccessToken(user._id, user.tokenVersion);
  const refreshTokenValue = generateRefreshTokenValue();
  const refreshTokenHash = hashRefreshToken(refreshTokenValue);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_SECONDS * 1000);
  return { accessToken, refreshTokenValue, refreshTokenHash, expiresAt };
};

const issueTokenPair = async (user, { userAgent = '', ip = '' } = {}) => {
  const { accessToken, refreshTokenValue, refreshTokenHash, expiresAt } = buildTokenPair(user);

  await RefreshToken.create({
    user: user._id,
    tokenHash: refreshTokenHash,
    expiresAt,
    userAgent,
    ip,
  });

  return {
    accessToken,
    refreshToken: refreshTokenValue,
    refreshExpiresAt: expiresAt,
  };
};

const rotateRefreshToken = async (refreshTokenValue, { userAgent = '', ip = '' } = {}) => {
  if (!refreshTokenValue) {
    throw new AppError('Refresh token required', 401);
  }

  const tokenHash = hashRefreshToken(refreshTokenValue);
  const existing = await RefreshToken.findOne({ tokenHash });

  if (!existing) {
    throw new AppError('Invalid refresh token', 401);
  }

  if (existing.revoked) {
    logger.warn(
      { userId: existing.user, requestId: existing._id },
      'Refresh token reuse detected — revoking all user sessions'
    );
    await RefreshToken.updateMany(
      { user: existing.user, revoked: false },
      { $set: { revoked: true } }
    );
    await User.findByIdAndUpdate(existing.user, { $inc: { tokenVersion: 1 } });
    throw new AppError('Refresh token reuse detected — all sessions revoked', 401);
  }

  if (existing.expiresAt < new Date()) {
    await existing.deleteOne();
    throw new AppError('Refresh token expired', 401);
  }

  const user = await User.findById(existing.user);
  if (!user) {
    throw new AppError('User no longer exists', 401);
  }

  const newPair = await issueTokenPair(user, { userAgent, ip });

  existing.revoked = true;
  await existing.save();

  return { ...newPair, user };
};

const revokeRefreshToken = async (refreshTokenValue) => {
  if (!refreshTokenValue) return;
  const tokenHash = hashRefreshToken(refreshTokenValue);
  await RefreshToken.updateOne(
    { tokenHash, revoked: false },
    { $set: { revoked: true } }
  );
};

const revokeAllUserTokens = async (userId) => {
  await RefreshToken.updateMany(
    { user: userId, revoked: false },
    { $set: { revoked: true } }
  );
};

const bumpTokenVersion = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { tokenVersion: 1 } },
    { new: true }
  );
  return user;
};

const cleanupExpiredTokens = async () => {
  const result = await RefreshToken.deleteMany({ expiresAt: { $lt: new Date() } });
  return result.deletedCount;
};

export {
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  bumpTokenVersion,
  cleanupExpiredTokens,
};