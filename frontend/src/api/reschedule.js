/** 改期 API */
import http from '@/utils/http'

export function applyReschedule(data) {
  return http.post('/reschedule/apply', data)
}

export function getRescheduleList(params) {
  return http.get('/reschedule/list', { params })
}

export function approveReschedule(data) {
  return http.post('/reschedule/approve', data)
}

export function rejectReschedule(data) {
  return http.post('/reschedule/reject', data)
}

export function getRescheduleStatus(params) {
  return http.get('/reschedule/status', { params })
}
