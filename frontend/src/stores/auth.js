/**
 * 认证 Store
 *
 * 替代原 admin.html 中的全局变量：AUTH_TOKEN, AUTH_MID, shopName
 * 登录态持久化通过 storage 抽象层读写，未来可无缝切换至 wx 存储。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get, set, remove, clear } from '@/utils/storage'
import { login as loginApi, register as registerApi } from '@/api/merchant'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(get('mzg_admin_token') || '')
  const mId = ref(get('mzg_admin_mid') || '')
  const shopName = ref(get('mzg_admin_shopname') || '')

  const isLoggedIn = computed(() => !!token.value)

  async function login(credentials) {
    const res = await loginApi(credentials)
    if (res.code === 0) {
      token.value = res.data.token
      mId.value = res.data.mId
      shopName.value = res.data.shopName || ''
      set('mzg_admin_token', token.value)
      set('mzg_admin_mid', mId.value)
      set('mzg_admin_shopname', shopName.value)
    }
    return res
  }

  async function register(data) {
    return registerApi(data)
  }

  function logout() {
    token.value = ''
    mId.value = ''
    shopName.value = ''
    clear()
  }

  function updateShopName(name) {
    shopName.value = name
    set('admin_shopname', name)
  }

  return { token, mId, shopName, isLoggedIn, login, register, logout, updateShopName }
})
