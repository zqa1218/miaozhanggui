const { Router } = require('express');
const multer = require('multer');
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/ExcelController');

const upload = multer({ dest: '/tmp/excel/' });
const router = Router();

router.use(authRequired);
router.get('/template', ctrl.template);
router.post('/import', upload.single('file'), ctrl.importFile);
router.get('/batches', ctrl.batches);
router.get('/batches/:batchId', ctrl.batchDetail);
router.get('/export', ctrl.exportData);

module.exports = router;
