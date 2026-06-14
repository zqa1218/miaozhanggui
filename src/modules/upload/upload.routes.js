const router = require('express').Router();
const multer = require('multer');
const ctrl = require('./upload.controller');
const config = require('../../config');
const deviceId = require('../../middlewares/deviceId');
const rateLimiter = require('../../middlewares/rateLimiter');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxSize },
  fileFilter: (_req, file, cb) => {
    if (config.upload.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型，仅支持 JPG/PNG/WebP/GIF'), false);
    }
  },
});

// Multer 错误拦截包装器
function handleMulter(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ success: false, data: null, message: `文件过大，最大支持 ${Math.round(config.upload.maxSize / 1024 / 1024)}MB` });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ success: false, data: null, message: '文件字段名错误或超出数量限制' });
        }
        return res.status(400).json({ success: false, data: null, message: err.message || '上传失败' });
      }
      next();
    });
  };
}

// C端上传（设备限流）+ B端上传（已有 auth token 或公开）
router.post('/upload/image', deviceId, rateLimiter(20, 60), handleMulter(upload.single('file')), ctrl.uploadSingle);
router.post('/upload/images', deviceId, rateLimiter(10, 60), handleMulter(upload.array('files', 10)), ctrl.uploadBatch);

module.exports = router;
