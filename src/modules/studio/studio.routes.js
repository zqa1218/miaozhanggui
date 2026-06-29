const router = require('express').Router();
const ctrl = require('./studio.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validator');
const { createStudioSchema, updateStudioSchema, deleteStudioSchema, updateOrderSchema, removeImageSchema } = require('./studio.validator');

//   客户端公开
router.get('/studios-lite', ctrl.getLiteList);

//   管理端（需认证）
router.get('/studios', auth, ctrl.getFullList);
router.post('/add-studio', auth, validate(createStudioSchema), ctrl.create);
router.post('/edit-studio', auth, validate(updateStudioSchema), ctrl.update);
router.post('/delete-studio', auth, validate(deleteStudioSchema), ctrl.remove);

//   排序 & 图片管理
router.post('/update-studio-order', auth, validate(updateOrderSchema), ctrl.updateOrder);
router.post('/studio/:studioId/remove-image', auth, validate(removeImageSchema), ctrl.removeImage);

module.exports = router;
