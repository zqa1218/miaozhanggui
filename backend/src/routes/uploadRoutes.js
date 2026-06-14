const { Router } = require('express');
const multer = require('multer');
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/UploadController');

const upload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

router.use(authRequired);
router.post('/image', upload.single('file'), ctrl.single);
router.post('/images', upload.array('files', 20), ctrl.multi);

module.exports = router;
