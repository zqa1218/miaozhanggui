const router = require('express').Router();
const ctrl = require('./settings.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validator');
const { saveSettingsSchema } = require('./settings.validator');

router.get('/settings', ctrl.getSettings);
router.post('/settings', auth, validate(saveSettingsSchema), ctrl.saveSettings);

module.exports = router;
