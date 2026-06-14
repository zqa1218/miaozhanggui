const { Router } = require('express');
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/SettingsController');
const router = Router();

router.get('/', authRequired, ctrl.getMine);
router.post('/', authRequired, ctrl.save);

module.exports = router;
