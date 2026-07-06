import { defineStore } from 'pinia'
import { ref } from 'vue'
import { studioApi } from '@/api/studioApi'
import { storage } from '@/utils/storage'

export const useStudioStore = defineStore('studio', () => {
  const list = ref([])
  const current = ref(null)
  const loading = ref(false)
  const cities = ref([])

  function mId() {
    return storage.get('mzg_admin_mid', '')
  }

  async function fetchList(params = {}) {
    loading.value = true
    try {
      const res = await studioApi.list(params)
      const data = (res && res.data) || null
      if (data && Array.isArray(data)) {
        list.value = data
      } else if (res && res.success === false) {
        console.error('fetchList failed:', res.message)
      }
    } catch (e) {
      console.error('fetchList error:', e)
    } finally {
      loading.value = false
    }
  }

  /** C端: 公开精简列表 (无鉴权) */
  async function fetchLiteList(params = {}) {
    loading.value = true
    try {
      const res = await studioApi.lite(params)
      const data = (res && res.data) || null
      if (data && Array.isArray(data)) {
        list.value = data
      } else if (res && res.success === false) {
        console.error('fetchLiteList failed:', res.message)
      }
    } catch (e) {
      console.error('fetchLiteList error:', e)
    } finally {
      loading.value = false
    }
  }

  /** 带 mId 注入的完整列表查询 (供 B 端使用) */
  async function fetchFullList() {
    return fetchList({ mId: mId() })
  }

  async function fetchDetail(id, merchantId) {
    loading.value = true
    try {
      const idToUse = merchantId || mId()
      const res = await studioApi.detail(id, idToUse)
      if (res && (res.success || res.code === 0) && res.data) {
        current.value = res.data
      }
    } catch (e) {
      console.error('fetchDetail error:', e)
    } finally {
      loading.value = false
    }
  }

  /** 获取所有可选城市列表 */
  async function fetchCities() {
    try {
      const res = await studioApi.cities();
      cities.value = (res && res.data) || [];
    } catch (e) {
      console.error('fetchCities error:', e);
    }
  }

  /** 软删除项目 (mId 由 JWT token 携带，无需前端传) */
  async function remove(id) {
    await studioApi.remove(id)
    list.value = list.value.filter(s => s.id !== id)
  }

  return { list, current, loading, cities, fetchList, fetchLiteList, fetchFullList, fetchDetail, fetchCities, remove }
})
