<script setup>
import { ref, onMounted, provide, computed } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { storage, getQueryParam } from '@/utils/storage'
import { useRefreshBus } from '@/composables/useRefreshBus'
import RefreshButton from '@/components/shared/RefreshButton.vue'
const router = useRouter()
const route = useRoute()
const announcement = ref('')
const loading = ref(true)

// ── 刷新总线 ──
const refreshBus = useRefreshBus()
provide('refreshBus', refreshBus)

// ★ 仅从当前 URL 提取 mId（不读取 localStorage，避免粘性绑定）
const urlMId = getQueryParam('mId') || ''
const mId = ref(urlMId || '')

// ── 当前 Tab ──
const currentTab = computed(() => {
  if (route.path.startsWith('/my-orders')) return 'orders'
  return 'home'
})

function switchTab(tab) {
  if (tab === 'home') router.push('/studio-filter')
  else router.push('/my-orders')
}

onMounted(async () => {
  if (urlMId) {
    mId.value = urlMId
  }
  if (mId.value) {
    try {
      const res = await fetch(`/api/settings?mId=${mId.value}`)
      const json = await res.json()
      if (json.success && json.data) {
        announcement.value = json.data.announcement || ''
      }
    } catch {}
  }
  loading.value = false
})
</script>

<template>
  <div class="client-layout">
    <div class="nav-bar">
      <span class="nav-title">喵喵预约</span>
      <RefreshButton
        :on-refresh="async () => { refreshBus.trigger() }"
        :cooldown="3000"
        :timeout="15000"
      />
    </div>
    <div class="notice-wrap" v-if="announcement">
      <span>&#x1F4E2;</span> {{ announcement }}
    </div>

    <main class="client-main">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
    <!-- ★ 底部导航栏 -->
    <nav class="tab-bar">
      <button
        :class="['tab-item', { active: currentTab === 'home' }]"
        @click="switchTab('home')"
      >
        <span class="tab-icon">🏠</span>
        <span class="tab-label">预约主页</span>
      </button>
      <button
        :class="['tab-item', { active: currentTab === 'orders' }]"
        @click="switchTab('orders')"
      >
        <span class="tab-icon">📋</span>
        <span class="tab-label">我的订单</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.client-layout {
  min-height: 100vh; padding-bottom: 70px;
  background: #F9F8F6; position: relative; z-index: 1;
}

.nav-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 24px; background: #fff;
  border-bottom: 1px solid #F0EDE8;
}
.nav-title {
  font-size: 16px; font-weight: 700; color: #4A4A4A;
}

.client-main {
  position: relative; z-index: 1;
  min-height: calc(100vh - 180px);
  padding: 24px 32px 16px;
}

/* ─── 底部导航 ─── */
.tab-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
  display: flex; background: #fff; border-top: 1px solid #F0EDE8;
  padding: 6px 0 env(safe-area-inset-bottom, 8px);
  box-shadow: 0 -2px 12px rgba(0,0,0,.03);
}
.tab-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 6px 0; border: none; background: none; cursor: pointer;
  transition: all 0.15s; font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}
.tab-icon { font-size: 20px; }
.tab-label { font-size: 10px; font-weight: 600; color: #B0B0B0; }
.tab-item.active .tab-label { color: #D4893E; }

/* 页面过渡 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from { opacity: 0; transform: translateY(12px); }
.fade-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
