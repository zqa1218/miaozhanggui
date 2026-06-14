const router = require('express').Router();
const multer = require('multer');
const upload = multer({ dest: '/tmp/order-imports/', limits: { fileSize: 5 * 1024 * 1024 } });
const ctrl = require('./order.controller');
const auth = require('../../middlewares/auth');
const deviceId = require('../../middlewares/deviceId');
const validate = require('../../middlewares/validator');
const rateLimiter = require('../../middlewares/rateLimiter');
const {
  createOrderSchema, createOrderV2Schema,
  payDepositSchema, confirmLockSchema,
  updateStatusSchema, archiveOrderSchema,
} = require('./order.validator');

//   用户端
router.post('/create-order', deviceId, rateLimiter(10, 60), ctrl.createOrder);
router.post('/create-order-v2', deviceId, rateLimiter(10, 60), validate(createOrderV2Schema), ctrl.createOrderV2);
router.get('/my-orders', ctrl.getMyOrders);
router.post('/pay-deposit', validate(payDepositSchema), ctrl.payDeposit);
router.post('/pay-final', ctrl.payFinal);

//   管理端（需认证）
router.get('/orders', auth, ctrl.getOrders);
router.post('/update-status', auth, validate(updateStatusSchema), ctrl.updateStatus);
router.post('/archive-order', auth, validate(archiveOrderSchema), ctrl.archiveOrder);
router.get('/order-stats', auth, ctrl.getTodayStats);
router.post('/order/confirm-lock', auth, validate(confirmLockSchema), ctrl.confirmLock);

//   用户端 + 管理端通用
router.get('/order-detail', ctrl.getOrderDetail);
router.get('/booked-times-v2', ctrl.getBookedTimesV2);

// ═══ 状态机 API ═══
// 管理端：支付与服务状态
router.post('/order/confirm-deposit',  auth, validate(require('./order.validator').statusTransitionSchema), ctrl.confirmDepositPaid);
router.post('/order/confirm-completed', auth, validate(require('./order.validator').statusTransitionSchema), ctrl.confirmCompleted);
router.post('/order/mark-fulfilled',    auth, validate(require('./order.validator').statusTransitionSchema), ctrl.markFulfilled);

// 管理端：审批改期/取消
router.post('/order/approve-reschedule', auth, validate(require('./order.validator').statusTransitionSchema), ctrl.approveReschedule);
router.post('/order/reject-reschedule',  auth, validate(require('./order.validator').statusTransitionSchema), ctrl.rejectReschedule);
router.post('/order/approve-cancel',     auth, validate(require('./order.validator').statusTransitionSchema), ctrl.approveCancel);
router.post('/order/reject-cancel',      auth, validate(require('./order.validator').statusTransitionSchema), ctrl.rejectCancel);

// 用户端：发起申请
router.post('/order/request-reschedule', deviceId, validate(require('./order.validator').requestRescheduleSchema), ctrl.requestReschedule);
router.post('/order/request-cancel',     deviceId, validate(require('./order.validator').requestCancelSchema),     ctrl.requestCancel);

// 管理端：恢复已取消订单
router.post('/order/restore', auth, validate(require('./order.validator').statusTransitionSchema), ctrl.restoreOrder);

// 管理端：下载订单导入模板
router.get('/order/import-template', auth, ctrl.downloadImportTemplate);
// 管理端：导出订单 Excel
router.get('/order/export', auth, ctrl.exportOrders);
// 管理端：Excel 批量导入订单
router.post('/order/import', auth, upload.single('file'), ctrl.importOrders);

module.exports = router;
