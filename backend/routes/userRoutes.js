import express from 'express';
import { registerUser, authUser, getUserProfile, searchUsersByEmail } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { registerRules, loginRules } from '../validators/rules.js';

const router = express.Router();

router.post('/', registerRules, validate, registerUser);
router.post('/login', loginRules, validate, authUser);
router.get('/profile', protect, getUserProfile);
router.get('/search', protect, searchUsersByEmail);

export default router;
