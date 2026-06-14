<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStudioStore } from '@/stores/studio'
import { storage, getQueryParam } from '@/utils/storage'

const route = useRoute()
const router = useRouter()
const store = useStudioStore()

// 全量URL扫描 → route.query → client localStorage（严禁读取 mzg_admin_mid）
const mId = getQueryParam('mId') || route.query.mId || storage.get('mzg_client_mid', '') || ''

onMounted(() => {
  if (mId) store.fetchDetail(route.params.id, mId)
})

function goBooking() {
  router.push(`/booking/${route.params.id}?mId=${mId}`)
}
</script>

<template>
  <div class="studio-detail fade-in-up" style="padding:16px;max-width:640px;margin:0 auto;">
    <div v-if="store.loading" class="empty-state">加载中...</div>
    <div v-else-if="!mId" class="empty-state">
      <p>缺少商家 ID，请从正确链接进入</p>
    </div>
    <template v-else-if="store.current">
      <img v-if="store.current.coverUrl" :src="store.current.coverUrl"
           style="width:100%;max-height:240px;object-fit:cover;border-radius:14px;margin-bottom:14px;" />
      <h1 style="font-size:20px;">{{ store.current.title }}</h1>
      <p style="font-size:13px;color:var(--text-sub);margin-top:4px;">{{ store.current.description }}</p>

      <div class="section" style="margin:12px 0;">
        <div class="section-title">定价信息</div>
        <div style="font-size:13px;line-height:2;">
          <div v-if="store.current.singlePrice">单张: <strong>¥{{ store.current.singlePrice }}</strong></div>
          <div v-if="store.current.packagePrice">套餐: <strong>¥{{ store.current.packagePrice }}</strong> / {{ store.current.packageSessionCount || '?' }}次</div>
          <div>定金: {{ store.current.depositRatio || 30 }}%</div>
          <div v-if="store.current.baseStartTime">工作时间: {{ store.current.baseStartTime }}—{{ store.current.baseEndTime }}</div>
        </div>
      </div>

      <button class="btn-primary" @click="goBooking">立即预约</button>
    </template>
    <div v-else class="empty-state">项目不存在或已下架</div>
  </div>
</template>
