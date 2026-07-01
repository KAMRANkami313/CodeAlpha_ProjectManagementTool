import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import env from './env.js';

/**
 * Connect to MongoDB and wire up connection-level logging.
 *
 * Mongoose buffers operations during initial connect, so we don't need to
 * block server boot. However, runtime disconnects/reconnects are logged so
 * operators can spot infrastructure issues from the logs alone.
 */
const connectDB = async () => {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    logger.info({ host: mongoose.connection.host }, 'MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — Mongoose will auto-reconnect');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  try {
    const conn = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    logger.info({ host: conn.connection.host, db: conn.connection.name }, 'MongoDB initial connection established');
    return conn;
  } catch (error) {
    logger.fatal({ err: error }, 'MongoDB initial connection failed — exiting');
    process.exit(1);
  }
};

export default connectDB;