const path = require('path');
const fs = require('fs');
const config = require('../../config');

const uploadRoot = path.join(__dirname, '..', '..', '..', config.upload.dir);

//   确保基础目录存在
['covers', 'details', 'qrcodes', 'refunds', 'avatars', 'general', 'order_refs', 'styles'].forEach((sub) => {
  const dir = path.join(uploadRoot, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 *   保存文件（从 multer 处理后的文件信息）
 * @param {string} subDir   - 子目录名
 * @param {Object} file     - multer file 对象 (或 { buffer, originalname })
 * @returns {string}         - 可访问的相对 URL 路径
 */
function saveFile(subDir, file) {
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

  // ★ 动态创建子目录（防止未知文件夹导致 ENOENT）
  const dirPath = path.join(uploadRoot, subDir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

  const destPath = path.join(dirPath, filename);

  if (file.buffer) {
    fs.writeFileSync(destPath, file.buffer);
  } else if (file.path) {
    fs.renameSync(file.path, destPath);
  }

  return `/uploads/${subDir}/${filename}`;
}

/**
 * 将相对 URL 路径（/uploads/...）解析为本机绝对路径
 * 仅处理本机 uploads 目录内文件，且防目录穿越；否则返回 null
 */
function resolveLocalPath(urlPath) {
  if (!urlPath) return null;
  if (!urlPath.startsWith('/uploads/')) return null;
  const rel = urlPath.slice('/uploads/'.length);
  if (!rel) return null;
  const fullPath = path.join(uploadRoot, rel);
  if (!fullPath.startsWith(uploadRoot)) return null; // 防穿越
  return fullPath;
}

/** 删除文件（仅限本机 /uploads/ 内的相对路径，安全边界） */
function deleteFile(urlPath) {
  const fullPath = resolveLocalPath(urlPath);
  if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

/** 判断 URL 是否属于本机 uploads 目录 */
function isLocalUrl(urlPath) {
  return !!resolveLocalPath(urlPath);
}

/** 获取文件绝对路径 */
function getAbsolutePath(urlPath) {
  return resolveLocalPath(urlPath);
}

module.exports = { saveFile, deleteFile, getAbsolutePath, resolveLocalPath, isLocalUrl };
