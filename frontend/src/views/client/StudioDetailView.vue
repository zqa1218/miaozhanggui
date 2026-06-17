<template>
  <div class="detail-view fade-in-up">
    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrap">加载中...</div>
    <div v-else-if="!studio" class="empty-state">项目不存在</div>

    <template v-else>
      <!-- 项目头图 -->
      <img v-if="studio.coverUrl" :src="studio.coverUrl" class="detail-img" />
      <div v-else class="detail-img placeholder-img"><i class="fa-solid fa-camera"></i></div>

      <!-- 详情面板 -->
      <div class="detail-panel">
        <div class="detail-title">{{ studio.title }}</div>
        <div v-if="studio.city" class="detail-city">
          <i class="fa-solid fa-location-dot"></i> {{ studio.city }}
        </div>
        <div class="detail-desc">{{ studio.description }}</div>
        <div class="detail-price">
          ¥{{ studio.isStyleEnabled ? '多种' : (studio.singlePrice || 0) }}
          <small>{{ studio.isStyleEnabled ? '样式可选' : '起' }}</small>
        </div>
      </div>

      <!-- 步骤指示器 -->
      <div class="steps-bar">
        <span :class="{ active: store.currentStep === 1 }">1. 选择服务</span>
        <span class="arrow">→</span>
        <span :class="{ active: store.currentStep === 2 }">2. 确认下单</span>
      </div>

      <!-- 步骤内容 -->
      <component :is="currentComponent" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStudioStore } from '@/stores/studio'
import { useBookingStore } from '@/stores/booking'
import BookingStep1 from './BookingStep1.vue'
import BookingStep2 from './BookingStep2.vue'

const route = useRoute()
const studioStore = useStudioStore()
const store = useBookingStore()

const loading = ref(true)
const studio = ref(null)

onMounted(async () => {
  try {
    await studioStore.fetchFullList()
    const s = studioStore.studios.find(s => s.id == route.params.id)
    if (s) {
      studio.value = s
      store.init(s)
    }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => store.init(null))

const stepComponents = { 1: BookingStep1, 2: BookingStep2 }
const currentComponent = computed(() => stepComponents[store.currentStep])
</script>

<style scoped>
.detail-view { max-width: 600px; margin: 0 auto; padding: 0 16px 40px; }
.loading-wrap, .empty-state { text-align: center; padding: 60px; color: var(--text-secondary, #8E8E8E); }

.detail-img { width: 100%; height: 220px; object-fit: cover; border-radius: 16px; }
.placeholder-img { background: var(--color-disabled-bg, #F4F2EE); display: flex; align-items: center; justify-content: center; font-size: 40px; color: #B0B0B0; border-radius: 16px; }

.detail-panel { background: var(--bg-card, #fff); border-radius: 20px; padding: 20px; margin-top: -20px; position: relative; box-shadow: 0 4px 16px rgba(0,0,0,.05); }
.detail-title { font-size: 20px; font-weight: 700; color: var(--text-primary, #4A4A4A); }
.detail-city { font-size: 13px; color: #D4893E; margin-top: 4px; }
.detail-desc { font-size: 14px; color: var(--text-primary, #4A4A4A); margin-top: 6px; }
.detail-price { font-size: 24px; color: #D4893E; font-weight: 700; margin-top: 8px; }
.detail-price small { font-size: 14px; font-weight: 400; color: var(--text-secondary, #8E8E8E); }

.steps-bar { display: flex; align-items: center; gap: 8px; margin: 16px 0; font-size: 14px; color: var(--text-secondary, #8E8E8E); }
.steps-bar .active { color: #D4893E; font-weight: 700; }
.steps-bar .arrow { color: #B0B0B0; }
.steps-bar .done { color: #A8D8B9; }
</style>
