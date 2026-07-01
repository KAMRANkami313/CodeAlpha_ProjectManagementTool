import pino from 'pino';
import env from '../config/env.js';

/**
 * Application-wide structured logger.
 *
 * Uses pino for performance (fastest JSON logger in the Node ecosystem).
 * In development, prettifies output for readability. In production, emits
 * newline-delimited JSON ready for log aggregators (Datadog, Loki, ELK).
 *
 * Usage:
 *   import logger from '../utils/logger.js';
 *   logger.info({ userId, projectId }, 'project created');
 *
 * NEVER use console.log in app code — the logger is the only sink.
 */

const baseLogger = pino({
  level: env.logLevel,
  base: {
    service: 'collabtask-api',
    env: env.nodeEnv,
  },
  redact: {
    // Never let secrets leak into logs
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.refreshToken',
      '*.jwtSecret',
      '*.mongoUri',
    ],
    censor: '[REDACTED]',
  },
  ...(env.isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname,service',
            singleLine: false,
          },
        },
      }),
});

export default baseLogger;