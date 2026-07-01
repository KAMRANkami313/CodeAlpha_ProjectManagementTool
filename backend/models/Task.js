import mongoose from 'mongoose';

const LABEL_COLOR_HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const subtaskSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Subtask title cannot exceed 200 characters'],
    },
    done: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: false, timestamps: { createdAt: false, updatedAt: true } }
);

const labelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [30, 'Label name cannot exceed 30 characters'],
    },
    color: {
      type: String,
      required: true,
      match: [LABEL_COLOR_HEX, 'Label color must be a valid hex (e.g. #6366f1)'],
    },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Task title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [4000, 'Description cannot exceed 4000 characters'],
    },
    status: {
      type: String,
      enum: ['Todo', 'In Progress', 'In Review', 'Done'],
      default: 'Todo',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    position: {
      type: Number,
      default: 0,
    },
    labels: {
      type: [labelSchema],
      default: [],
      validate: {
        validator: (labels) => labels.length <= 20,
        message: 'A task cannot have more than 20 labels',
      },
    },
    subtasks: {
      type: [subtaskSchema],
      default: [],
      validate: {
        validator: (subs) => subs.length <= 100,
        message: 'A task cannot have more than 100 subtasks',
      },
    },
    completedAt: {
      type: Date,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    timeEstimateMinutes: {
      type: Number,
      default: null,
      min: [0, 'Time estimate cannot be negative'],
      max: [525600, 'Time estimate cannot exceed 1 year in minutes'],
    },
    timeSpentMinutes: {
      type: Number,
      default: 0,
      min: [0, 'Time spent cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ project: 1, isArchived: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ dueDate: 1 });

taskSchema.virtual('subtaskProgress').get(function () {
  if (!this.subtasks || this.subtasks.length === 0) return null;
  const done = this.subtasks.filter((s) => s.done).length;
  return { done, total: this.subtasks.length, percent: Math.round((done / this.subtasks.length) * 100) };
});

taskSchema.virtual('isOverdue').get(function () {
  if (!this.dueDate) return false;
  if (this.status === 'Done') return false;
  return new Date(this.dueDate) < new Date();
});

taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

const Task = mongoose.model('Task', taskSchema);
export default Task;