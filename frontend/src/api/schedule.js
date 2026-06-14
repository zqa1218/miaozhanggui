/** 排期 API */
import http from '@/utils/http'

/** C端：获取已预订时段 */
export function getBookedTimes(params) {
  return http.get('/booked-times', { params })
}

/** C端 V2：获取高精度闭合时间块占用 */
export function getBookedTimesV2(params) {
  return http.get('/booked-times-v2', { params })
}

/** 管理端：获取不可用时段网格 */
export function getUnavailableGrid(params) {
  return http.get('/unavailable-slots/grid', { params })
}

/** 管理端：保存不可用时段 */
export function saveUnavailableSlots(data) {
  return http.post('/unavailable-slots/save', data)
}
