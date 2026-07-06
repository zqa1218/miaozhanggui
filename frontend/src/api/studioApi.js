import http from '@/utils/http'

export const studioApi = {
  /** B端: 完整列表 (需 JWT) */
  list(params) {
    return http.get('/studios', params)
  },

  /** C端: 公开精简列表 (无鉴权，客人可直接访问) */
  lite(params) {
    return http.get('/studios-lite', params)
  },

  /** 获取单个项目详情 — 通过公开列表过滤实现 (C端/B端通用) */
  detail(id, mId) {
    return http.get('/studios-lite', { mId }).then(res => {
      const arr = Array.isArray(res.data) ? res.data : (res.data && res.data.list ? res.data.list : [])
      if (arr.length > 0) {
        const found = arr.find(s => String(s.id) === String(id))
        if (found) return { success: true, code: 0, data: found }
        return { success: false, code: 1, message: '项目不存在或已下架', data: null }
      }
      // 兼容旧格式 / 直接返回对象
      if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
        return { success: true, code: 0, data: res.data }
      }
      return { success: false, code: 1, message: res.message || '项目不存在', data: null }
    })
  },

  /** 获取有活跃项目的城市列表 */
  cities() {
    return http.get('/studios-cities')
  },

  create(data) {
    return http.post('/add-studio', data)
  },

  update(id, data) {
    return http.post('/edit-studio', { ...data, id })
  },

  remove(id) {
    return http.post('/delete-studio', { id })
  },
}
