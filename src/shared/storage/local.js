const path = require('path');
const fs = require('fs');
const config = require('../../config');

const uploadRoot = path.join(__dirname, '..', '..', '..', config.upload.dir);

//   确保目录存在
['covers', 'details', 'qrcodes', 'refunds', 'avatars'].forEach((sub) => {
  const dir = path.join(uploadRoot, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 *   保存文件（从 multer 处理后的文件信息）
 * @param {string} subDir   - 子目录名
 * @param {Object} file     - multer file 对象 (或 { buffer, originalname })
 * @returns {string}         - 可访问的 URL 路径
 */
function saveFile(subDir, file) {
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const destPath = path.join(uploadRoot, subDir, filename);

  if (file.buffer) {
    fs.writeFileSync(destPath, file.buffer);
  } else if (file.path) {
    fs.renameSync(file.path, destPath);
  }

  return `/uploads/${subDir}/${filename}`;
}

/** 删除文件 */
function deleteFile(urlPath) {
  if (!urlPath) return;
  const fullPath = path.join(uploadRoot, '..', urlPath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

/** 获取文件绝对路径 */
function getAbsolutePath(urlPath) {
  return path.join(uploadRoot, '..', urlPath);
}

module.exports = { saveFile, deleteFile, getAbsolutePath };
