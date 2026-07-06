/** 订单 API */
import http from '@/utils/http'

/** C端：创建订单 */
export function createOrder(data) {
  return http.post('/create-order', data)
}

/** C端 V2：高精度闭合时间下单 */
export function createOrderV2(data) {
  return http.post('/create-order-v2', data)
}

/** 管理端：确认锁定订单（第二重锁：hard_lock） */
export function confirmLock(data) {
  return http.post('/order/confirm-lock', data)
}

/** C端：支付定金后预锁时段（第一重锁：pre_lock） */
export function preLockOrder(data) {
  return http.post('/bookings/pre-lock', data)
}

/** C端：我的订单列表 */
export function getMyOrders(params) {
  return http.get('/my-orders', params)
}

/** C端：支付订金 */
export function payDeposit(data) {
  return http.post('/pay-deposit', data)
}

/** C端：支付尾款 */
export function payFinal(data) {
  return http.post('/pay-final', data)
}

/** C端：订单详情 */
export function getOrderDetail(params) {
  return http.get('/order-detail', { params })
}

/** 管理端：全部订单 */
export function getOrders(params) {
  return http.get('/orders', { params })
}

/** 管理端：更新订单状态 */
export function updateStatus(data) {
  return http.post('/update-status', data)
}

/** 管理端：归档订单 */
export function archiveOrder(data) {
  return http.post('/archive-order', data)
}

/** 管理端：今日统计 */
export function getOrderStats() {
  return http.get('/order-stats')
}

/** C端：申请改期 */
export function requestReschedule(data) {
  return http.post('/order/request-reschedule', data)
}

/** C端：申请取消 */
export function requestCancel(data) {
  return http.post('/order/request-cancel', data)
}

/** 管理端：确认收款 (定金) */
export function confirmDeposit(data) {
  return http.post('/order/confirm-deposit', data)
}

/** 管理端：确认结清 (尾款) */
export function confirmCompleted(data) {
  return http.post('/order/confirm-completed', data)
}

/** 管理端：同意改期 */
export function approveReschedule(data) {
  return http.post('/order/approve-reschedule', data)
}

/** 管理端：拒绝改期 */
export function rejectReschedule(data) {
  return http.post('/order/reject-reschedule', data)
}

/** 管理端：同意取消 */
export function approveCancel(data) {
  return http.post('/order/approve-cancel', data)
}

/** 管理端：拒绝取消 */
export function rejectCancel(data) {
  return http.post('/order/reject-cancel', data)
}
