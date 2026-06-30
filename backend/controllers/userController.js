import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

const DUPLICATE_KEY_CODE = 11000;

const isDuplicateKeyError = (error) =>
  error?.code === DUPLICATE_KEY_CODE || error?.message?.includes('E11000');

const registerUser = async (req, res, next) => {
  const { name, email, password } = req.body;

  try {
    const user = await User.create({ name, email, password });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    next(error);
  }
};

const authUser = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (error) {
    next(error);
  }
};

const searchUsersByEmail = async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

export { registerUser, authUser, getUserProfile, searchUsersByEmail };
