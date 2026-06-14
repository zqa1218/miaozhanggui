import { storage } from '@/utils/storage'

function authHeaders() {
  const token = storage.get('mzg_admin_token', '')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function getMId() {
  return storage.get('mzg_admin_mid', '')
}

export const adminApi = {
  // Settings
  getSettings() {
    const mId = getMId()
    return fetch(`/api/settings?mId=${mId}`, { headers: authHeaders() }).then(r => r.json())
  },
  saveSettings(data) {
    const mId = getMId()
    return fetch('/api/settings', {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, mId })
    }).then(r => r.json())
  },

  // Studios (项目列表)
  getStudios() {
    const mId = getMId()
    return fetch(`/api/studios?mId=${mId}`, { headers: authHeaders() }).then(r => r.json())
  },

  // Stats
  getStats() {
    const mId = getMId()
    return fetch(`/api/order-stats?mId=${mId}`, { headers: authHeaders() }).then(r => r.json())
  },

  // Notifications
  getNotifications() {
    const mId = getMId()
    return fetch(`/api/notifications?mId=${mId}`, { headers: authHeaders() }).then(r => r.json())
  },
  getUnreadCount() {
    const mId = getMId()
    return fetch(`/api/notifications/unread?mId=${mId}`, { headers: authHeaders() }).then(r => r.json())
  },
  markNotificationsRead(ids) {
    const mId = getMId()
    return fetch('/api/notifications/mark-read', {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, mId })
    }).then(r => r.json())
  },

  // Logs
  getLogs() {
    const mId = getMId()
    return fetch(`/api/logs?mId=${mId}`, { headers: authHeaders() }).then(r => r.json())
  },
  clearLogs() {
    const mId = getMId()
    return fetch('/api/clear-logs', {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ mId })
    }).then(r => r.json())
  },

  // Upload
  uploadImage(file, folder = 'general') {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', folder)
    return fetch('/api/upload/image', { method: 'POST', headers: authHeaders(), body: fd }).then(r => r.json())
  },
}
