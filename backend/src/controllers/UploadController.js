const path = require('path');
const fs = require('fs');
const { AppError } = require('../middleware/errorHandler');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');

// 确保上传目录存在
['covers','details','qrcodes','refunds','styles'].forEach(d => {
  const p = path.join(UPLOAD_DIR, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const UploadController = {
  // 单图上传
  async single(req, res, next) {
    try {
      if (!req.file) throw new AppError('未选择文件', 400);
      const folder = req.body.folder || 'general';
      const dir = path.join(UPLOAD_DIR, folder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const ext = path.extname(req.file.originalname) || '.jpg';
      const filename = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
      const dest = path.join(dir, filename);
      fs.renameSync(req.file.path, dest);
      const url = '/uploads/' + folder + '/' + filename;
      res.json({ success: true, data: { url } });
    } catch (err) { next(err); }
  },

  // 多图上传
  async multi(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) throw new AppError('未选择文件', 400);
      const folder = req.body.folder || 'general';
      const dir = path.join(UPLOAD_DIR, folder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const urls = req.files.map(f => {
        const ext = path.extname(f.originalname) || '.jpg';
        const filename = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
        fs.renameSync(f.path, path.join(dir, filename));
        return '/uploads/' + folder + '/' + filename;
      });
      res.json({ success: true, data: { urls } });
    } catch (err) { next(err); }
  },
};
module.exports = UploadController;
