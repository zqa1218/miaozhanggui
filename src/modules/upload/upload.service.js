const path = require('path');
const sharp = require('sharp');
const storage = require('../../shared/storage/local');
const config = require('../../config');

/**
 *   保存上传的图片（支持压缩，保留原始格式）
 */
async function saveImage(file, subDir = 'covers') {
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

  // 根据原始格式选择压缩策略 —— QR 码/截图保留 PNG
  let buffer = file.buffer;
  try {
    const isPng = file.mimetype === 'image/png' || ext === '.png';
    if (isPng) {
      buffer = await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .png({ quality: 85, compressionLevel: 9 })
        .toBuffer();
    } else {
      buffer = await sharp(file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    }
  } catch {
    // sharp 失败则用原文件
  }

  const url = storage.saveFile(subDir, { buffer, originalname: filename });
  return { url };
}

module.exports = { saveImage };
