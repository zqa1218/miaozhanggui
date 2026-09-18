<script setup>
import { ref, onMounted, provide, computed } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { House, Tickets } from '@element-plus/icons-vue'
import logoHorizontal from '@/assets/images/logo-horizontal.svg?raw'
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
      <!-- 品牌横版 Logo（设计交付 logo/logo-horizontal.svg）
           内联而非 <img>：该 SVG 的字标是 <text>（未转曲），内联才能继承
           页面的字体栈，保证与全站排版一致。 -->
      <span class="nav-brand" v-html="logoHorizontal"></span>
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
        <el-icon class="tab-icon"><House /></el-icon>
        <span class="tab-label">预约主页</span>
      </button>
      <button
        :class="['tab-item', { active: currentTab === 'orders' }]"
        @click="switchTab('orders')"
      >
        <el-icon class="tab-icon"><Tickets /></el-icon>
        <span class="tab-label">我的订单</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.client-layout {
  min-height: 100vh; padding-bottom: 72px;
  /* 透明：让 body 上的页面背景图透出来。磨砂面板要靠它才有层次。 */
  background: transparent; position: relative; z-index: 1;
}

/* 吸顶导航：内容会从它下面滚过，用 --surface-2（高不透明度）保证滚动时可读 */
.nav-bar {
  position: sticky; top: 0; z-index: var(--z-sticky);
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--surface-2);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid var(--glass-hairline);
}
/* Logo 按高度 32px 使用（设计规范给了 24/32/40 三档） */
.nav-brand {
  display: inline-flex; align-items: center;
  height: 32px; line-height: 0;
}
.nav-brand :deep(svg) {
  height: 32px; width: auto; display: block;
}

.client-main {
  position: relative; z-index: 1;
  min-height: calc(100vh - 180px);
  padding: var(--space-6) var(--gutter) var(--space-4);
}

/* ─── 底部导航 ─── */
.tab-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: var(--z-sticky);
  display: flex;
  background: var(--surface-2);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border-top: 1px solid var(--glass-hairline);
  padding: 6px 0 env(safe-area-inset-bottom, 8px);
  box-shadow: 0 -1px 12px rgba(74,70,66,.05);
}
.tab-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 6px 0; border: none; background: none; cursor: pointer;
  transition: color var(--duration-1) var(--ease-out);
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}
.tab-icon {
  font-size: 20px; color: var(--text-3);
  transition: color var(--duration-1) var(--ease-out);
}
/* 原为 10px + #B0B0B0（2.17:1）—— 同时踩中「过小」与「对比度不足」，现 11px + 5.01:1 */
.tab-label { font-size: 11px; font-weight: 600; color: var(--text-3); }
.tab-item.active .tab-icon,
.tab-item.active .tab-label { color: var(--color-primary-ink); }

/* 页面过渡 */
.fade-enter-active, .fade-leave-active {
  transition: opacity var(--duration-3) var(--ease-out),
              transform var(--duration-3) var(--ease-out);
}
.fade-enter-from { opacity: 0; transform: translateY(10px); }
.fade-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 767px) {
  .client-main { padding: var(--space-4) var(--gutter-mobile) var(--space-3); }
  .nav-bar { padding: var(--space-3) var(--space-4); }
}
</style>
