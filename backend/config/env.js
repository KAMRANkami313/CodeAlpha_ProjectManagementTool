import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized environment configuration.
 *
 * Every other module in the app MUST import values from here instead of
 * reading process.env directly. This guarantees:
 *   1. Fail-fast validation at boot — missing required vars crash the
 *      process immediately with a clear message instead of failing later
 *      inside a request handler.
 *   2. A single place to coerce types (numbers, booleans) and apply
 *      sensible defaults.
 *   3. A documented surface area for what the app actually needs.
 */

const required = (key) => {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    // eslint-disable-next-line no-console
    console.error(`[config/env] Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback) => {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1' || value === 'yes';
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

  // Database
  mongoUri: required('MONGO_URI'),

  // Auth
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

  // CORS
  clientUrl: required('CLIENT_URL'),

  // Logging
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Rate limits (overridable via env)
  rateLimitWindowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: toInt(process.env.RATE_LIMIT_MAX, 300),
  authRateLimitMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 10),
  registerRateLimitMax: toInt(process.env.REGISTER_RATE_LIMIT_MAX, 5),

  // Request body size
  bodyLimit: process.env.BODY_LIMIT || '10mb',
};

export default env;