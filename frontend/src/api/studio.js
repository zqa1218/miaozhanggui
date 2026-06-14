/** 项目/工作室 API */
import http from '@/utils/http'

/** 客户端：获取项目轻量列表 */
export function getStudiosLite() {
  return http.get('/studios-lite')
}

/** 管理端：获取项目完整列表 */
export function getStudios() {
  return http.get('/studios')
}

/** 管理端：新增项目 */
export function addStudio(data) {
  return http.post('/add-studio', data)
}

/** 管理端：编辑项目 */
export function editStudio(data) {
  return http.post('/edit-studio', data)
}

/** 管理端：删除项目 */
export function deleteStudio(data) {
  return http.post('/delete-studio', data)
}
