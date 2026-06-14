const router = require('express').Router();
const ctrl = require('./reschedule.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validator');
const { applySchema, approveRejectSchema } = require('./reschedule.validator');

router.post('/reschedule/apply', validate(applySchema), ctrl.apply);
router.get('/reschedule/list', auth, ctrl.list);
router.post('/reschedule/approve', auth, validate(approveRejectSchema), ctrl.approve);
router.post('/reschedule/reject', auth, validate(approveRejectSchema), ctrl.reject);
router.get('/reschedule/status', ctrl.getStatusByOrder);

module.exports = router;
