import Notification from '../models/Notification.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { parsePagination, isPaginated, buildPaginationMeta } from '../utils/pagination.js';

const getNotifications = asyncHandler(async (req, res) => {
  const filter = { recipient: req.user._id };

  if (isPaginated(req)) {
    const { page, limit, skip } = parsePagination(req);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate('sender', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
    ]);
    return res.json({
      notifications,
      unreadCount,
      pagination: buildPaginationMeta(page, limit, total),
    });
  }

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(50),
    Notification.countDocuments({ ...filter, isRead: false }),
  ]);

  res.json({ notifications, unreadCount });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id,
  });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  notification.isRead = true;
  await notification.save();

  res.json(notification);
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );

  res.json({ message: 'All notifications marked as read' });
});

export { getNotifications, markNotificationRead, markAllNotificationsRead };
