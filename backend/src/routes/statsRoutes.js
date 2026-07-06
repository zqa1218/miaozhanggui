const { Router } = require('express');
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/StatsController');
const router = Router();
router.use(authRequired);
router.get('/order-stats', ctrl.orderStats);
module.exports = router;
