import mongoose from 'mongoose';

const VALID_TYPES = [
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_DELETED',
  'PROJECT_MEMBER_ADDED',
  'PROJECT_MEMBER_REMOVED',
  'TASK_CREATED',
  'TASK_UPDATED',
  'TASK_DELETED',
  'TASK_ASSIGNED',
  'TASK_UNASSIGNED',
  'TASK_STATUS_CHANGED',
  'TASK_PRIORITY_CHANGED',
  'TASK_DUE_DATE_CHANGED',
  'TASK_ARCHIVED',
  'TASK_UNARCHIVED',
  'TASK_LABELS_CHANGED',
  'SUBTASK_CREATED',
  'SUBTASK_UPDATED',
  'SUBTASK_TOGGLED',
  'SUBTASK_DELETED',
  'COMMENT_CREATED',
];

const activitySchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: VALID_TYPES,
      index: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: [300, 'Activity summary cannot exceed 300 characters'],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ project: 1, createdAt: -1 });
activitySchema.index({ actor: 1, createdAt: -1 });
activitySchema.index({ task: 1, createdAt: -1 });

const ACTIVITY_TTL_SECONDS = Number.parseInt(process.env.ACTIVITY_TTL_DAYS || '365', 10) * 24 * 60 * 60;
if (ACTIVITY_TTL_SECONDS > 0) {
  activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: ACTIVITY_TTL_SECONDS });
}

const Activity = mongoose.model('Activity', activitySchema);

export { VALID_TYPES as ACTIVITY_TYPES };
export default Activity;