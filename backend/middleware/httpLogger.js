import pinoHttp from 'pino-http';
import logger from '../utils/logger.js';

/**
 * HTTP request logger.
 *
 * Wraps pino-http and binds each log line to `req.id` so a single request's
 * lifecycle (in → handler → out → error) can be filtered by correlation id.
 *
 * Excludes the /health endpoint to keep health-check polling out of logs.
 */
const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} → ${res.statusCode} ${err.message}`,
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
});

export default httpLogger;