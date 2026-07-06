/**
 * 系统设置 Store
 *
 * 公告、收款码等全局配置
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSettings, saveSettings } from '@/api/settings'

export const useSettingsStore = defineStore('settings', () => {
  const announcement = ref('')
  const shopAlipayQrUrl = ref('')
  const shopWechatQrUrl = ref('')
  const declarationEnabled = ref(false)
  const declarationContent = ref('')
  const loading = ref(false)

  async function fetch(mId) {
    loading.value = true
    try {
      const params = mId ? { mId } : {}
      const res = await getSettings(params)
      if (res.data) {
        announcement.value = res.data.announcement || ''
        shopAlipayQrUrl.value = res.data.shopAlipayQrUrl || ''
        shopWechatQrUrl.value = res.data.shopWechatQrUrl || ''
        declarationEnabled.value = res.data.declarationEnabled || false
        declarationContent.value = res.data.declarationContent || ''
      }
    } finally {
      loading.value = false
    }
  }

  async function save(data) {
    const res = await saveSettings(data)
    if (res.code === 0) await fetch()
    return res
  }

  return { announcement, shopAlipayQrUrl, shopWechatQrUrl, declarationEnabled, declarationContent, loading, fetch, save }
})
