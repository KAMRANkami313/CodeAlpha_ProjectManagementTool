import Notification from '../models/Notification.js';
import { getIO } from '../socket/socketManager.js';

/**
 * Creates a notification in the DB and pushes it in real-time to the
 * recipient's personal socket room (named after their user id), if connected.
 * Controllers call this instead of touching Notification/io directly.
 */
const notifyUser = async ({ recipient, sender, type, message, project, task = null }) => {
  // Never notify someone about their own action
  if (recipient.toString() === sender.toString()) return null;

  const notification = await Notification.create({
    recipient,
    sender,
    type,
    message,
    project,
    task,
  });

  const populated = await notification.populate('sender', 'name email');

  try {
    getIO().to(`user:${recipient.toString()}`).emit('notification:new', populated);
  } catch (err) {
    // Socket layer may not be initialized in some contexts (e.g. tests) - notification is still saved.
  }

  return populated;
};

/**
 * Notify every project member except the actor performing the action.
 */
const notifyProjectMembers = async ({ memberIds, sender, type, message, project, task = null }) => {
  const recipients = memberIds.filter((id) => id.toString() !== sender.toString());
  await Promise.all(
    recipients.map((recipient) =>
      notifyUser({ recipient, sender, type, message, project, task })
    )
  );
};

export { notifyUser, notifyProjectMembers };
