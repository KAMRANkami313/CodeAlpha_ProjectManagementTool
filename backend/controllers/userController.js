import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

const registerUser = async (req, res, next) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

const authUser = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    res.json({ _id: user._id, name: user.name, email: user.email });
  } catch (error) {
    next(error);
  }
};

/**
 * Lightweight lookup so the frontend can show "is this a valid email to
 * invite" feedback before submitting the add-member form.
 */
const searchUsersByEmail = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) return res.json([]);

    const users = await User.find({ email: { $regex: query, $options: 'i' } })
      .select('name email')
      .limit(5);

    res.json(users);
  } catch (error) {
    next(error);
  }
};

export { registerUser, authUser, getUserProfile, searchUsersByEmail };
