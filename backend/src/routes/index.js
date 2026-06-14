const { Router } = require('express');
const ctrl = require('../controllers/StudioController');
const SettingsController = require('../controllers/SettingsController');

const router = Router();

// ==================== 公开接口（无需登录） ====================
// 认证
router.use('/auth',       require('./authRoutes'));
// 公开设置（C端根据 mId 拉取公告和收款码）
router.get('/settings',   SettingsController.getPublic);
// 核心资源
router.use('/styles',     require('./styleRoutes'));
router.use('/studios',    require('./studioRoutes'));
router.use('/bookings',   require('./bookingRoutes'));
router.use('/order',      require('./orderRoutes'));
// 别名
router.post('/add-studio', ctrl.addStudio);

// ==================== B端需登录接口 ====================
router.use('/admin/orders',       require('./adminOrderRoutes'));
router.use('/admin/settings',      require('./settingsRoutes'));   // GET/POST /api/admin/settings
router.use('/admin/notifications', require('./notificationRoutes'));
router.use('/admin/logs',          require('./logRoutes'));
router.use('/admin/upload',        require('./uploadRoutes'));
router.use('/admin/excel',         require('./excelRoutes'));
router.use('/admin/stats',         require('./statsRoutes'));

module.exports = router;
