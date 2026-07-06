const router = require('express').Router();
const ctrl = require('./refund.controller');
const validate = require('../../middlewares/validator');
const { applyCancelSchema } = require('./refund.validator');

const auth = require('../../middlewares/auth');

router.post('/apply-cancel', validate(applyCancelSchema), ctrl.applyCancel);
router.post('/refund/reject', auth, ctrl.rejectRefund);
router.post('/refund/approve', auth, ctrl.approveRefund);
router.get('/refund/list', auth, ctrl.getRefundList);

module.exports = router;
