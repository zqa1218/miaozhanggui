const router = require('express').Router();
const ctrl = require('./style.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validator');
const { createStyleSchema, updateStyleSchema, deleteStyleSchema } = require('./style.validator');

// 管理端（需认证）
router.get('/styles', auth, ctrl.getList);
router.post('/styles', auth, validate(createStyleSchema), ctrl.create);
router.post('/styles/edit', auth, validate(updateStyleSchema), ctrl.update);
router.post('/styles/delete', auth, validate(deleteStyleSchema), ctrl.remove);

module.exports = router;
