import express from 'express';
import rateLimit from 'express-rate-limit';
import {
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
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  registerRules,
  loginRules,
  refreshTokenRules,
  logoutRules,
  profileUpdateRules,
  changePasswordRules,
} from '../validators/rules.js';
import env from '../config/env.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.registerRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Please try again later.' },
});

const refreshLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.authRateLimitMax * 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many refresh attempts. Please log in again.' },
});

const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many password change attempts. Try again later.' },
});

const presenceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', registerLimiter, registerRules, validate, registerUser);
router.post('/login', authLimiter, loginRules, validate, authUser);
router.post('/refresh', refreshLimiter, refreshTokenRules, validate, refreshAccessToken);
router.post('/logout', protect, logoutRules, validate, logout);
router.post('/logout-all', protect, logoutAll);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, profileUpdateRules, validate, updateUserProfile);
router.put('/password', protect, passwordChangeLimiter, changePasswordRules, validate, changePassword);
router.post('/presence', protect, presenceLimiter, touchPresence);
router.get('/search', protect, searchUsersByEmail);

export default router;