/** 退款 API */
import http from '@/utils/http'

export function applyCancel(data) {
  return http.post('/apply-cancel', data)
}

export function rejectRefund(data) {
  return http.post('/refund/reject', data)
}

export function approveRefund(data) {
  return http.post('/refund/approve', data)
}

export function getRefundList(params) {
  return http.get('/refund/list', { params })
}
