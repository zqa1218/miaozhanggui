const { Router } = require('express');
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/NotificationController');
const router = Router();
router.use(authRequired);
router.get('/', ctrl.list);
router.get('/unread', ctrl.unreadCount);
router.post('/mark-read', ctrl.markRead);
module.exports = router;
