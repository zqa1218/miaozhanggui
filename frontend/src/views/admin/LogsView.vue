<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/api/adminApi'

const logs = ref([])
const loading = ref(true)

onMounted(async () => {
  await loadLogs()
})

async function loadLogs() {
  loading.value = true
  const res = await adminApi.getLogs()
  if (res.success) logs.value = res.data
  loading.value = false
}

async function clearAll() {
  if (!confirm('确定清空所有日志？')) return
  await adminApi.clearLogs()
  logs.value = []
}
</script>

<template>
  <div class="fade-in-up">
    <h2 style="margin:12px 0;">操作日志
      <button class="btn-secondary" @click="clearAll" style="font-size:11px;padding:4px 12px;color:var(--danger);">清空日志</button>
    </h2>
    <div v-if="loading" class="empty-state">加载中...</div>
    <div v-else-if="logs.length === 0" class="empty-state">暂无日志</div>
    <div v-else v-for="l in logs" :key="l.id" class="section" style="padding:8px 14px;margin:6px 14px;">
      <span style="color:var(--sub);font-size:11px;margin-right:8px;">{{ l.created_at }}</span>
      <span style="font-size:13px;">{{ l.action }}</span>
    </div>
  </div>
</template>
