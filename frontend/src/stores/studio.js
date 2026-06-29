import { defineStore } from 'pinia'
import { ref } from 'vue'
import { studioApi } from '@/api/studioApi'
import { storage } from '@/utils/storage'
import { ElMessage } from 'element-plus'

export const useStudioStore = defineStore('studio', () => {
  const list = ref([])
  const current = ref(null)
  const loading = ref(false)

  // ── 排序模式 ──
  const isSortMode = ref(false)
  const isSavingOrder = ref(false)

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

  /** 软删除项目 (mId 由 JWT token 携带，无需前端传) */
  async function remove(id) {
    await studioApi.remove(id)
    list.value = list.value.filter(s => s.id !== id)
  }

  // ── 排序模式 actions ──

  /**
   * 切换排序模式（只做开关，数据由父组件显式传 prop 给 SortableStudioList）
   */
  function toggleSortMode() {
    if (isSortMode.value) {
      isSortMode.value = false
      return
    }
    isSortMode.value = true
  }

  /**
   * 保存排序（由 SortableStudioList 组装好 orderedList 后调用）
   */
  async function saveOrderWithList(orderedList) {
    if (!orderedList || orderedList.length === 0) {
      ElMessage.warning('没有可保存的项目排序')
      return
    }

    isSavingOrder.value = true
    try {
      await studioApi.updateOrder(orderedList)

      // 回写排序值到原列表
      list.value.forEach(studio => {
        const updated = orderedList.find(o => o.id === studio.id)
        if (updated) studio.sort_order = updated.sort_order
      })

      // 重排 list.value
      list.value.sort((a, b) => {
        const aOrder = a.sort_order || 0
        const bOrder = b.sort_order || 0
        if (aOrder === 0 && bOrder === 0) return new Date(b.created_at || 0) - new Date(a.created_at || 0)
        if (aOrder === 0) return 1
        if (bOrder === 0) return -1
        return aOrder - bOrder
      })

      ElMessage.success(`排序已保存，${orderedList.length} 个项目已更新，C端同步生效`)
      isSortMode.value = false
    } catch (err) {
      ElMessage.error('排序保存失败，请重试')
      throw err
    } finally {
      isSavingOrder.value = false
    }
  }

  function cancelSort() {
    isSortMode.value = false
  }

  return {
    list, current, loading,
    isSortMode, isSavingOrder,
    fetchList, fetchLiteList, fetchFullList, fetchDetail, remove,
    toggleSortMode, saveOrderWithList, cancelSort,
  }
})
