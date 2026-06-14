import http from '@/utils/http'

export function getStyles(mId) {
  return http.get('/styles', { mId })
}

export function createStyle(data) {
  return http.post('/styles', data)
}

export function editStyle(data) {
  return http.post('/styles/edit', data)
}

export function deleteStyle(data) {
  return http.post('/styles/delete', data)
}
