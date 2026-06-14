import http from '@/utils/http'

export const bookingApi = {
  getAvailable(studioId, date) {
    return http.get('/booked-times-v2', { studioId, date })
  },

  /** 支付定金 — 后端自动创建 pre_lock slot_booking */
  create(data) {
    return http.post('/pay-deposit', data)
  },

  /** 第二重锁：摄影师确认后 hard_lock */
  confirmLock(orderNo) {
    return http.post('/order/confirm-lock', { orderNo })
  },

  cancel(orderId) {
    return http.post(`/bookings/${orderId}/cancel`)
  },
}
