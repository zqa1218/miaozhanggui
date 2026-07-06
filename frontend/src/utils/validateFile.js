/**
 * validateImageFile — 图片文件前端校验（纯函数）
 *
 * 在发起上传请求前，先校验文件类型和大小，
 * 避免无效请求打到服务器。
 *
 * @param {File} file
 * @param {Object} [opts]
 * @param {number} [opts.maxSize=5*1024*1024]  最大字节数，默认 5MB
 * @param {string[]} [opts.allowedTypes]       允许的 MIME 类型
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageFile(file, opts = {}) {
  const maxSize = opts.maxSize || 5 * 1024 * 1024
  const allowedTypes = opts.allowedTypes || [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ]

  if (!file) {
    return { valid: false, error: '未选择文件' }
  }

  if (!allowedTypes.includes(file.type)) {
    const exts = [...new Set(allowedTypes.map(t => t.split('/')[1]))].join('、')
    return { valid: false, error: `不支持的文件类型，仅允许 ${exts} 格式` }
  }

  if (file.size > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024)
    return { valid: false, error: `文件过大，最大支持 ${mb}MB` }
  }

  if (file.size === 0) {
    return { valid: false, error: '文件为空，请重新选择' }
  }

  return { valid: true }
}
