import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import mongoose from 'mongoose';

import env from './config/env.js';
import connectDB from './config/db.js';
import logger from './utils/logger.js';

import requestId from './middleware/requestId.js';
import httpLogger from './middleware/httpLogger.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

import userRoutes from './routes/userRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

import { initSocket } from './socket/socketManager.js';

// Boot
connectDB();

const app = express();
const server = http.createServer(app);

// Realtime layer
initSocket(server);

// --- Security & transport middleware ---
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || env.clientUrls.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

// --- Tracing & request logging ---
// Order matters: requestId must run BEFORE httpLogger so each log line carries the id.
app.use(requestId);
app.use(httpLogger);

// --- Body parsing ---
app.use(express.json({ limit: env.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));

// --- Rate limiting ---
const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  // Prefer per-user limiting when authenticated; fall back to IPv6-safe IP key.
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req),
});
app.use('/api', apiLimiter);

// --- Health check (excluded from auto-logging by httpLogger config) ---
app.get('/health', (req, res) => {
  const readyStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const mongoState = readyStates[mongoose?.connection?.readyState] ?? 'unknown';
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    requestId: req.id,
    services: {
      mongo: mongoState === 'connected' ? 'ok' : mongoState,
    },
  });
});

// --- API routes ---
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ name: 'CollabTask API', status: 'running', docs: '/health' });
});

// --- 404 + error handler (must be last) ---
app.use(notFound);
app.use(errorHandler);

// --- Start server ---
server.listen(env.port, () => {
  logger.info(
    { port: env.port, env: env.nodeEnv },
    `CollabTask API listening on port ${env.port}`
  );
});

// --- Graceful shutdown ---
const gracefulShutdown = (signal) => {
  logger.info({ signal }, 'Shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  gracefulShutdown('uncaughtException');
});