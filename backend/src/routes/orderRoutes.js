const { Router } = require('express');
const ctrl = require('../controllers/BookingController');

const router = Router();

// POST /api/order/confirm-lock → 摄影师确认锁
router.post('/confirm-lock', ctrl.confirmLock);

// POST /api/order/:id/cancel
router.post('/:id/cancel', ctrl.cancel);

module.exports = router;
