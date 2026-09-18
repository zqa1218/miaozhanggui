const router = require('express').Router();
const ctrl = require('./auth.controller');
const clientAuth = require('../../middlewares/clientAuth');

// 公开接口
router.post('/client/auth/login', ctrl.login);
router.post('/client/auth/mp-login', ctrl.mpLogin);

// 需客户端登录
router.post('/client/auth/bind', clientAuth, ctrl.bind);
router.post('/client/auth/mp-phone', clientAuth, ctrl.mpPhone);
router.get('/client/auth/me', clientAuth, ctrl.me);

module.exports = router;
