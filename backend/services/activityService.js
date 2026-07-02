import Activity from '../models/Activity.js';
import { broadcastToProject } from './realtimeService.js';
import logger from '../utils/logger.js';

const recordActivity = async ({
  project,
  actor,
  type,
  summary,
  task = null,
  metadata = {},
  emit = true,
}) => {
  try {
    const activity = await Activity.create({
      project,
      actor,
      type,
      summary,
      task,
      metadata,
    });

    const populated = await activity.populate('actor', 'name email avatar');

    if (emit) {
      broadcastToProject(project, 'activity:new', populated);
    }

    return populated;
  } catch (err) {
    logger.warn(
      { err, project, type, actor },
      'Failed to record activity — non-blocking'
    );
    return null;
  }
};

const recordBulk = async (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  try {
    const activities = await Activity.insertMany(entries, { ordered: false });
    return activities;
  } catch (err) {
    logger.warn({ err, count: entries.length }, 'Failed to bulk record activities');
    return [];
  }
};

export { recordActivity, recordBulk };