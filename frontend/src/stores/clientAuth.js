/**
 * 客户端用户认证 Store
 * 管理微信/QQ OAuth 登录与 JWT Token
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage } from '@/utils/storage'

const TOKEN_KEY = 'mzg_client_token'
const USER_KEY = 'mzg_client_user'

export const useClientAuthStore = defineStore('clientAuth', () => {
  const token = ref(storage.get(TOKEN_KEY) || '')
  const user = ref(parseUser())

  const isLoggedIn = computed(() => !!token.value)
  const nickname = computed(() => user.value?.nickname || '')

  function parseUser() {
    try {
      const raw = storage.get(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  async function oauthLogin(provider, code, name) {
    const res = await fetch('/api/client/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, code, nickname: name }),
    }).then(r => r.json())

    if (res.success || res.code === 0) {
      const data = res.data || res
      token.value = data.token
      user.value = data.user || null
      storage.set(TOKEN_KEY, data.token)
      storage.set(USER_KEY, JSON.stringify(data.user || {}))
      return { success: true, data }
    }
    return { success: false, message: res.message || '登录失败' }
  }

  function logout() {
    token.value = ''
    user.value = null
    storage.remove(TOKEN_KEY)
    storage.remove(USER_KEY)
  }

  function getAuthHeaders() {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return { token, user, isLoggedIn, nickname, oauthLogin, logout, getAuthHeaders }
})
