/**
 * 图片出口 URL 拼接工具
 * DB 中始终存储相对路径 /uploads/...，仅在响应出口按需拼接公网前缀。
 * 未来切换 OSS/CDN 只需改 config.assetBaseUrl 或此处实现。
 */
const config = require('../../config');

/**
 * @param {string|null|undefined} path 相对路径（如 /uploads/covers/xxx.jpg）或绝对 URL
 * @returns {string|null} 拼接后的绝对 URL；空值原样返回
 */
function assetUrl(path) {
  if (!path) return path || null;
  if (/^https?:\/\//i.test(path)) return path; // 已是绝对地址
  if (/^data:/i.test(path)) return path;       // base64 data URL
  const base = config.assetBaseUrl || '';
  if (!base) return path;                       // 未配置前缀 → 保持相对路径
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  return normalizedBase + normalizedPath;
}

module.exports = { assetUrl };
