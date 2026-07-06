<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/api/adminApi'

const notifications = ref([])
const loading = ref(true)

onMounted(async () => {
  const res = await adminApi.getNotifications()
  if (res.success) notifications.value = res.data
  loading.value = false
})

async function markAll() {
  await adminApi.markNotificationsRead([])
  notifications.value.forEach(n => n.is_read = 1)
}

async function markOne(n) {
  await adminApi.markNotificationsRead([n.id])
  n.is_read = 1
}
</script>

<template>
  <div class="fade-in-up">
    <h2 style="margin:12px 0;">通知消息
      <button class="btn-secondary" @click="markAll" style="font-size:11px;padding:4px 12px;">全部已读</button>
    </h2>
    <div v-if="loading" class="empty-state">加载中...</div>
    <div v-else-if="notifications.length === 0" class="empty-state">暂无通知</div>
    <div v-else v-for="n in notifications" :key="n.id" class="section"
         style="cursor:pointer;" :style="{ opacity: n.is_read ? 0.6 : 1 }" @click="markOne(n)">
      <strong>{{ n.title }}</strong>
      <span :class="'tag tag-' + ({info:'blue',success:'green',warning:'orange',danger:'red'}[n.type]||'blue')" style="margin-left:6px;">{{ n.type }}</span>
      <div style="font-size:12px;color:var(--sub);">{{ n.content }}</div>
      <div style="font-size:10px;color:#aaa;">{{ n.created_at }}</div>
    </div>
  </div>
</template>
