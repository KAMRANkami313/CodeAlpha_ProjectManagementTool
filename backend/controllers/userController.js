import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';

const DUPLICATE_KEY_CODE = 11000;

const isDuplicateKeyError = (error) =>
  error?.code === DUPLICATE_KEY_CODE || error?.message?.includes('E11000');

const buildAuthResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  token: generateToken(user._id),
});

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const user = await User.create({ name, email, password });
    res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError('Email already registered', 409);
    }
    throw error;
  }
});

const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  res.json(buildAuthResponse(user));
});

const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  });
});

const searchUsersByEmail = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim().length < 3) {
    return res.json([]);
  }

  const users = await User.find({
    email: { $regex: query.trim(), $options: 'i' },
  })
    .select('name email')
    .limit(5);

  res.json(users);
});

export { registerUser, authUser, getUserProfile, searchUsersByEmail };
