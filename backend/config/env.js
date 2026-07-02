import dotenv from 'dotenv';

dotenv.config();

const required = (key) => {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.error(`[config/env] Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

export const env = {
  nodeEnv,
  isProduction,
  isTest,
  isDevelopment: nodeEnv === 'development',

  port: toInt(process.env.PORT, 5000),

  mongoUri: required('MONGO_URI'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresDays: toInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 7),

  maxLoginAttempts: toInt(process.env.MAX_LOGIN_ATTEMPTS, 5),
  accountLockMinutes: toInt(process.env.ACCOUNT_LOCK_MINUTES, 15),

  clientUrl: required('CLIENT_URL'),
  clientUrls: required('CLIENT_URL')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  rateLimitWindowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: toInt(process.env.RATE_LIMIT_MAX, 300),
  authRateLimitMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 10),
  registerRateLimitMax: toInt(process.env.REGISTER_RATE_LIMIT_MAX, 5),

  bodyLimit: process.env.BODY_LIMIT || '10mb',
};

export default env;