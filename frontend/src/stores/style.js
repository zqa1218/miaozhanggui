import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getStyles, createStyle, editStyle, deleteStyle } from '@/api/style'
import { ElMessage } from 'element-plus'

export const useStyleStore = defineStore('style', () => {
  const styles = ref([])
  const loading = ref(false)

  async function fetchStyles(mId) {
    loading.value = true
    try {
      const res = await getStyles(mId)
      // 兼容 { success: true } 和 { code: 0 } 两种响应格式
      if (res && (res.success || res.code === 0)) {
        styles.value = res.data || []
      }
    } finally {
      loading.value = false
    }
  }

  async function create(data) {
    const res = await createStyle(data)
    if (res && (res.success || res.code === 0)) {
      ElMessage.success(res.message || '样式创建成功')
      await fetchStyles(data.mId)
      return true
    }
    ElMessage.error(res.message || '创建失败')
    return false
  }

  async function update(data) {
    const res = await editStyle(data)
    if (res && (res.success || res.code === 0)) {
      ElMessage.success(res.message || '样式更新成功')
      await fetchStyles(data.mId)
      return true
    }
    ElMessage.error(res.message || '更新失败')
    return false
  }

  async function remove(data) {
    const res = await deleteStyle(data)
    if (res && (res.success || res.code === 0)) {
      ElMessage.success(res.message || '样式已删除')
      await fetchStyles(data.mId)
      return true
    }
    ElMessage.error(res.message || '删除失败')
    return false
  }

  return { styles, loading, fetchStyles, create, update, remove }
})
