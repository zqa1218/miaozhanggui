/** 通知 API */
import http from '@/utils/http'

export function getNotifications(params) {
  return http.get('/notifications', { params })
}

export function getUnreadCount() {
  return http.get('/notifications/unread')
}

export function markAsRead(data) {
  return http.post('/notifications/mark-read', data)
}

export function getUserNotifications() {
  return http.get('/user-notifications')
}
