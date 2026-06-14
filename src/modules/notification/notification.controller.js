const service = require('./notification.service');
const logger = require('../../shared/logger');

async function getList(req, res) {
  try {
    const result = await service.getList(req.query.mId);
    res.rh.success(result);
  } catch (err) {
    logger.error('notification list error', err);
    res.rh.error('查询失败');
  }
}

async function getUnreadCount(req, res) {
  try {
    const result = await service.getUnreadCount(req.query.mId);
    res.rh.success(result);
  } catch (err) {
    logger.error('unread count error', err);
    res.rh.error('查询失败');
  }
}

async function markAsRead(req, res) {
  try {
    const result = await service.markAsRead(req.body.mId, req.body.ids);
    res.rh.success(result, '已标记为已读');
  } catch (err) {
    logger.error('markRead error', err);
    res.rh.error('操作失败');
  }
}

async function getUserNotifications(req, res) {
  try {
    const result = await service.getUserNotifications(req.query.mId, req.query.userDeviceId);
    res.rh.success(result);
  } catch (err) {
    logger.error('userNotifications error', err);
    res.rh.error('查询失败');
  }
}

module.exports = { getList, getUnreadCount, markAsRead, getUserNotifications };
