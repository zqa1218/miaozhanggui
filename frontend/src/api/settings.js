/** 系统设置 API */
import http from '@/utils/http'

/** 公开：获取设置（公告、收款码等），可传入 mId 等 query 参数 */
export function getSettings(params = {}) {
  return http.get('/settings', params)
}

/** 管理端：保存设置 */
export function saveSettings(data) {
  return http.post('/settings', data)
}
