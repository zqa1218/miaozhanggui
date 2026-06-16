const router = require('express').Router();
const ctrl = require('./merchant.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validator');
const { registerSchema, loginSchema, changePasswordSchema } = require('./merchant.validator');

//   公开接口
router.get('/merchants-public', ctrl.listPublic);
router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login', validate(loginSchema), ctrl.login);

//   需认证
router.post('/change-password', auth, validate(changePasswordSchema), ctrl.changePassword);
router.get('/profile', auth, ctrl.getProfile);
router.put('/profile', auth, ctrl.updateProfile);

module.exports = router;
