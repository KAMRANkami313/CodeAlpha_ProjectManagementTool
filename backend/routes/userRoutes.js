import express from 'express';
import rateLimit from 'express-rate-limit';
import { registerUser, authUser, getUserProfile, searchUsersByEmail } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { registerRules, loginRules } from '../validators/rules.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Please try again later.' },
});

router.post('/', registerLimiter, registerRules, validate, registerUser);
router.post('/login', authLimiter, loginRules, validate, authUser);
router.get('/profile', protect, getUserProfile);
router.get('/search', protect, searchUsersByEmail);

export default router;
