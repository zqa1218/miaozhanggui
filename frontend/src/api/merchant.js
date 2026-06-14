/** 商家认证 API */
import http from '@/utils/http'

export function login(data) {
  return http.post('/login', data)
}

export function register(data) {
  return http.post('/register', data)
}

export function changePassword(data) {
  return http.post('/change-password', data)
}

export function getProfile() {
  return http.get('/profile')
}

export function updateProfile(data) {
  return http.put('/profile', data)
}
