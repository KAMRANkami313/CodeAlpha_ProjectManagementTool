import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';

const BCRYPT_SALT_ROUNDS = 12;
const LOCK_TIME_MS = env.accountLockMinutes * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = env.maxLoginAttempts;

const preferencesSchema = new mongoose.Schema(
  {
    theme: {
      type: String,
      enum: ['system', 'light', 'dark'],
      default: 'system',
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    compactView: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
      trim: true,
      maxlength: [300, 'Bio cannot exceed 300 characters'],
    },
    preferences: {
      type: preferencesSchema,
      default: () => ({}),
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.virtual('isLocked').get(function () {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.virtual('isOnline').get(function () {
  if (!this.lastSeenAt) return false;
  return Date.now() - this.lastSeenAt.getTime() < 90 * 1000;
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.failedLoginAttempts = 1;
    this.lockUntil = null;
  } else {
    this.failedLoginAttempts += 1;
    if (
      this.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS &&
      !this.isLocked
    ) {
      this.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
    }
  }
  await this.save();
};

userSchema.methods.resetLoginAttempts = async function () {
  if (this.failedLoginAttempts === 0 && !this.lockUntil) return;
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  await this.save();
};

userSchema.methods.touchPresence = async function () {
  this.lastSeenAt = new Date();
  await this.save();
};

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

export { MAX_LOGIN_ATTEMPTS, LOCK_TIME_MS };
export default User;