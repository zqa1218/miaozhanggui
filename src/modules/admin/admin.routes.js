const router = require('express').Router();
const ctrl = require('./admin.controller');
const adminAuth = require('../../middlewares/adminAuth');

// 超管：邀请码管理
router.post('/admin/invitation-codes/generate', adminAuth, ctrl.generateCodes);
router.get('/admin/invitation-codes', adminAuth, ctrl.listCodes);

// 超管：商家列表
router.get('/admin/merchants', adminAuth, ctrl.listMerchants);

module.exports = router;
