const router = require('express').Router();
const ctrl = require('./studio.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validator');
const { createStudioSchema, updateStudioSchema, deleteStudioSchema } = require('./studio.validator');

//   客户端公开
router.get('/studios-lite', ctrl.getLiteList);

//   管理端（需认证）
router.get('/studios', auth, ctrl.getFullList);
router.post('/add-studio', auth, validate(createStudioSchema), ctrl.create);
router.post('/edit-studio', auth, validate(updateStudioSchema), ctrl.update);
router.post('/delete-studio', auth, validate(deleteStudioSchema), ctrl.remove);

module.exports = router;
