import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env.js';

export const ACCESS_TOKEN_EXPIRES_IN = env.accessTokenExpiresIn;
export const REFRESH_TOKEN_EXPIRES_SECONDS = env.refreshTokenExpiresDays * 24 * 60 * 60;

const generateAccessToken = (userId, tokenVersion) =>
  jwt.sign({ userId, tokenVersion, type: 'access' }, env.jwtSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

const generateRefreshTokenValue = () => crypto.randomBytes(48).toString('hex');

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);

export {
  generateAccessToken,
  generateRefreshTokenValue,
  hashRefreshToken,
  verifyAccessToken,
};