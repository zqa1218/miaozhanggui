const { Router } = require('express');
const ctrl = require('../controllers/BookingController');

const router = Router();

// GET  /api/bookings/available  → 查询可用时段
// POST /api/bookings/pay-deposit → 定金锁 (pre_lock)
router.get('/available',   ctrl.available);
router.post('/pay-deposit', ctrl.payDeposit);

module.exports = router;
