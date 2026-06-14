const service = require('./upload.service');
const logger = require('../../shared/logger');

/** POST /upload/image */
async function uploadSingle(req, res) {
  try {
    if (!req.file) return res.rh.fail('请选择文件', 400);
    const result = await service.saveImage(req.file, req.body.folder || 'covers');
    res.rh.success(result, '上传成功');
  } catch (err) {
    logger.error('uploadSingle error', err);
    res.rh.error('上传失败');
  }
}

/** POST /upload/images */
async function uploadBatch(req, res) {
  try {
    if (!req.files || req.files.length === 0) return res.rh.fail('请选择文件', 400);
    const urls = [];
    for (const file of req.files) {
      const result = await service.saveImage(file, req.body.folder || 'details');
      urls.push(result.url);
    }
    res.rh.success({ urls }, '上传成功');
  } catch (err) {
    logger.error('uploadBatch error', err);
    res.rh.error('上传失败');
  }
}

module.exports = { uploadSingle, uploadBatch };
