<template>
  <button
    class="refresh-btn"
    :class="{ loading: isRefreshing, success: showSuccess }"
    :disabled="isRefreshing || inCooldown"
    :title="tooltip"
    @click="handleClick"
  >
    <span class="refresh-icon" :class="{ spin: isRefreshing }">&#x21bb;</span>
    <span class="refresh-label">{{ label }}</span>
  </button>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  /** 刷新回调 — 返回 Promise，resolve 时表示成功 */
  onRefresh: { type: Function, required: true },
  /** 冷却时间（毫秒），防止连续点击 */
  cooldown: { type: Number, default: 3000 },
  /** 请求超时时间（毫秒） */
  timeout: { type: Number, default: 15000 },
})

const isRefreshing = ref(false)
const inCooldown = ref(false)
const showSuccess = ref(false)
const errorMsg = ref('')

const label = computed(() => {
  if (isRefreshing.value) return '同步中'
  if (showSuccess.value) return '已同步'
  return '刷新'
})

const tooltip = computed(() => {
  if (errorMsg.value) return errorMsg.value
  if (isRefreshing.value) return '正在同步最新数据...'
  if (inCooldown.value) return '请稍后再试'
  return '同步最新时间和预约状态'
})

let cooldownTimer = null
let successTimer = null

async function handleClick() {
  if (isRefreshing.value || inCooldown.value) return

  isRefreshing.value = true
  errorMsg.value = ''

  // 设置超时
  const timeoutId = setTimeout(() => {
    if (isRefreshing.value) {
      isRefreshing.value = false
      errorMsg.value = '刷新超时，请检查网络'
    }
  }, props.timeout)

  try {
    await props.onRefresh()
    clearTimeout(timeoutId)
    isRefreshing.value = false
    showSuccess.value = true
    errorMsg.value = ''

    // 冷却期
    inCooldown.value = true
    cooldownTimer = setTimeout(() => {
      inCooldown.value = false
    }, props.cooldown)

    // 成功提示 2 秒后消失
    successTimer = setTimeout(() => {
      showSuccess.value = false
    }, 2000)
  } catch (e) {
    clearTimeout(timeoutId)
    isRefreshing.value = false
    errorMsg.value = e?.message || '刷新失败，请检查网络'

    // 失败也进入短暂冷却
    inCooldown.value = true
    cooldownTimer = setTimeout(() => {
      inCooldown.value = false
      errorMsg.value = ''
    }, 2000)
  }
}

import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => {
  clearTimeout(cooldownTimer)
  clearTimeout(successTimer)
})
</script>

<style scoped>
.refresh-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; border-radius: 20px; border: 1.5px solid #E8E5DF;
  background: #fff; cursor: pointer; font-size: 13px; font-weight: 600;
  color: #5a7a65; transition: all 0.2s;
  white-space: nowrap; user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.refresh-btn:hover:not(:disabled) {
  border-color: #5a7a65; background: #e8f0eb;
}
.refresh-btn:disabled {
  opacity: 0.55; cursor: not-allowed;
}
.refresh-btn.loading {
  border-color: #F4A460; color: #D4893E; background: #FEF7EF;
}
.refresh-btn.success {
  border-color: #5A8A6A; color: #5A8A6A; background: #EDF6F0;
}

.refresh-icon {
  display: inline-block; font-size: 16px; line-height: 1;
  transition: transform 0.3s ease;
}
.refresh-icon.spin {
  animation: spin 0.8s linear infinite;
}

.refresh-label {
  font-size: 12px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
