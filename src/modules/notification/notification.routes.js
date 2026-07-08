const router = require('express').Router();
const ctrl = require('./notification.controller');
const auth = require('../../middlewares/auth');
const clientAuth = require('../../middlewares/clientAuth');

router.get('/notifications', auth, ctrl.getList);
router.get('/notifications/unread', auth, ctrl.getUnreadCount);
router.post('/notifications/mark-read', auth, ctrl.markAsRead);
router.get('/user-notifications', clientAuth, ctrl.getUserNotifications);

module.exports = router;
