<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/api/adminApi'

const revenue = ref(0)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await adminApi.getStats()
    if (res.success) revenue.value = res.data.revenue
  } catch {}
  loading.value = false
})
</script>

<template>
  <div class="fade-in-up">
    <h2 style="margin:12px 0;">今日概览</h2>
    <div class="grid-4" style="margin-bottom:14px;">
      <div class="stat-card"><div class="num" style="color:var(--purple);">¥{{ revenue }}</div><div class="lbl">今日营收</div></div>
      <div class="stat-card"><div class="num" style="color:var(--color-info);">0</div><div class="lbl">进行中</div></div>
      <div class="stat-card"><div class="num" style="color:var(--danger);">0</div><div class="lbl">退款审核</div></div>
      <div class="stat-card"><div class="num" style="color:var(--mint);">0</div><div class="lbl">已归档</div></div>
    </div>
  </div>
</template>
