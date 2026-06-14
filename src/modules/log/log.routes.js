const router = require('express').Router();
const ctrl = require('./log.controller');
const auth = require('../../middlewares/auth');

router.get('/logs', auth, ctrl.getList);
router.post('/logs', auth, ctrl.addLog);
router.post('/clear-logs', auth, ctrl.clearLogs);

module.exports = router;
