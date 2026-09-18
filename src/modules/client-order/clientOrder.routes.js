const router = require('express').Router();
const ctrl = require('./clientOrder.controller');
const clientAuth = require('../../middlewares/clientAuth');
const deviceId = require('../../middlewares/deviceId');
const rateLimiter = require('../../middlewares/rateLimiter');
const validate = require('../../middlewares/validator');
const { createOrderSchema } = require('./clientOrder.validator');

// 顾客端订单接口（均需登录，clientAuth 解析出 req.user.userId）
router.post('/client/order/create', clientAuth, deviceId, rateLimiter(10, 60), validate(createOrderSchema), ctrl.createOrder);
router.get('/client/orders', clientAuth, ctrl.listOrders);
router.get('/client/orders/:orderNo/timeline', clientAuth, ctrl.getTimeline);
router.get('/client/orders/:orderNo/payments', clientAuth, ctrl.getPayments);
router.get('/client/orders/:orderNo', clientAuth, ctrl.getDetail);
router.post('/client/order/:orderNo/cancel', clientAuth, deviceId, ctrl.cancel);

module.exports = router;
