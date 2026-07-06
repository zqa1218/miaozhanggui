const { Router } = require('express');
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/LogController');
const router = Router();
router.use(authRequired);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/clear', ctrl.clear);
module.exports = router;
