const Notification = require('../models/Notification');

const NotificationController = {
  async list(req, res, next) {
    try {
      const rows = await Notification.findByMId(req.merchant.mId);
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  },
  async unreadCount(req, res, next) {
    try {
      const count = await Notification.unreadCount(req.merchant.mId);
      res.json({ success: true, data: { count } });
    } catch (err) { next(err); }
  },
  async markRead(req, res, next) {
    try {
      await Notification.markRead(req.merchant.mId, req.body.ids);
      res.json({ success: true, message: '已标记' });
    } catch (err) { next(err); }
  },
};
module.exports = NotificationController;
