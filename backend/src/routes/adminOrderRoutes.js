const { Router } = require('express');
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/AdminOrderController');
const router = Router();
router.use(authRequired);
router.get('/', ctrl.list);
router.post('/update-status', ctrl.updateStatus);
module.exports = router;
