const path = require('path');
const sharp = require('sharp');
const storage = require('../../shared/storage'); // ★ 走统一 storage 出口（预留 OSS 分支）
const AppError = require('../../shared/errors/AppError');
const ERROR_CODES = require('../../shared/errors/errorCodes');

/**
 *   通过 magic bytes 检测真实图片格式（防止 .svg/.txt 冒充）
 * @param {Buffer} buf
 * @returns {'jpeg'|'png'|'gif'|'webp'|null}
 */
function detectImageFormat(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

const EXT_BY_FORMAT = { jpeg: '.jpg', png: '.png', gif: '.gif', webp: '.webp' };

/**
 *   保存上传的图片（按真实编码修正扩展名 + 压缩）
 */
async function saveImage(file, subDir = 'covers') {
  const buffer = file.buffer;
  const realFormat = detectImageFormat(buffer);
  if (!realFormat) {
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '文件内容不是有效图片（疑似伪装为图片的文件）');
  }

  // 按真实编码修正扩展名，消除 webp→.jpg 错配
  const ext = EXT_BY_FORMAT[realFormat];
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

  let outBuffer = buffer;
  try {
    if (realFormat === 'png') {
      outBuffer = await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .png({ quality: 85, compressionLevel: 9 })
        .toBuffer();
    } else if (realFormat === 'webp') {
      outBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } else if (realFormat === 'gif') {
      // GIF 保持原样（不重编码，避免丢失动画帧）
      outBuffer = buffer;
    } else {
      outBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    }
  } catch {
    // sharp 失败则用原文件（已通过 magic bytes 校验）
    outBuffer = buffer;
  }

  const url = storage.saveFile(subDir, { buffer: outBuffer, originalname: filename });
  return { url };
}

module.exports = { saveImage, detectImageFormat };
