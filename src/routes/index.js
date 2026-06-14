const router = require('express').Router();

//   引入所有模块路由
const merchantRoutes = require('../modules/merchant/merchant.routes');
const studioRoutes = require('../modules/studio/studio.routes');
const orderRoutes = require('../modules/order/order.routes');
const scheduleRoutes = require('../modules/schedule/schedule.routes');
const refundRoutes = require('../modules/refund/refund.routes');
const rescheduleRoutes = require('../modules/reschedule/reschedule.routes');
const settingsRoutes = require('../modules/settings/settings.routes');
const logRoutes = require('../modules/log/log.routes');
const notificationRoutes = require('../modules/notification/notification.routes');
const uploadRoutes = require('../modules/upload/upload.routes');
const styleRoutes = require('../modules/style/style.routes');

//   全局健康检查
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { timestamp: Math.floor(Date.now() / 1000) }, message: '喵掌柜服务运行中' });
});

//   注册各模块路由（均挂载到 /api 下，兼容前端现有调用）
router.use('/', merchantRoutes);
router.use('/', studioRoutes);
router.use('/', orderRoutes);
router.use('/', scheduleRoutes);
router.use('/', refundRoutes);
router.use('/', rescheduleRoutes);
router.use('/', settingsRoutes);
router.use('/', logRoutes);
router.use('/', notificationRoutes);
router.use('/', uploadRoutes);
router.use('/', styleRoutes);

module.exports = router;
