<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { storage } from '@/utils/storage'
import AdminHeader from '@/components/admin/AdminHeader.vue'
import { useRefreshBus } from '@/composables/useRefreshBus'

const router = useRouter()
const route = useRoute()

const shopName = ref(storage.get('mzg_admin_shopname', ''))
const mId = ref(storage.get('mzg_admin_mid', ''))
const merchantRole = ref('photographer')
const isAdminUser = ref(false)
const unreadCount = ref(0)

const token = storage.get('mzg_admin_token', '')
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    isAdminUser.value = !!payload.isAdmin
  } catch {}
}

const currentTab = ref('orders')
const tabsVisible = ref(false)
const isMobile = ref(false)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

function onResize() {
  windowWidth.value = window.innerWidth
  isMobile.value = windowWidth.value < 768
  if (windowWidth.value >= 768) tabsVisible.value = false
}
onMounted(() => { window.addEventListener('resize', onResize); onResize() })
onUnmounted(() => { window.removeEventListener('resize', onResize) })

const tabs = [
  { key: 'styles_lib', label: '预设', icon: '🎨' },
  { key: 'orders', label: '订单', icon: '📋' },
  { key: 'studios', label: '项目', icon: '📦' },
  { key: 'create', label: '创建', icon: '➕' },
  { key: 'settings', label: '设置', icon: '⚙️' },
  { key: 'notifications', label: '通知', icon: '🔔' },
  { key: 'logs', label: '日志', icon: '📝' },
]

function switchTab(key) {
  currentTab.value = key
  tabsVisible.value = false
  if (key === 'styles_lib') router.push('/admin/styles')
  if (key === 'orders') router.push('/admin/orders')
  if (key === 'studios') router.push('/admin/studios')
  if (key === 'create') router.push('/admin/studio/create/step1')
  if (key === 'settings') router.push('/admin/settings')
  if (key === 'notifications') router.push('/admin/notifications')
  if (key === 'logs') router.push('/admin/logs')
}

// 根据当前路由高亮 tab
const pathToTab = {
  '/admin/orders': 'orders', '/admin/studios': 'studios',
  '/admin/studio/create/step1': 'create', '/admin/studio/create/step2': 'create',
  '/admin/studio/create/step3': 'create',
  '/admin/styles': 'styles_lib', '/admin/styles/create': 'styles_lib',
  '/admin/settings': 'settings', '/admin/notifications': 'notifications', '/admin/logs': 'logs',
}
currentTab.value = pathToTab[route.path] || 'orders'

// 刷新总线
const refreshBus = useRefreshBus()
provide('refreshBus', refreshBus)

// 未读通知
onMounted(async () => {
  try {
    const res = await fetch(`/api/notifications/unread?mId=${mId.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await res.json()
    if (json.success || json.code === 0) {
      unreadCount.value = (json.data && json.data.count) || 0
    }
  } catch {}
})
</script>

<template>
  <AdminHeader :shop-name="shopName" :m-id="mId" :merchant-role="merchantRole" :is-admin-user="isAdminUser">
    <template #hamburger>
      <button
        v-if="isMobile"
        class="hamburger"
        @click="tabsVisible = !tabsVisible"
        aria-label="菜单"
      >
        <span></span><span></span><span></span>
      </button>
    </template>
  </AdminHeader>

  <!-- 桌面 tabs -->
  <div v-if="!isMobile" class="tabs">
    <div
      v-for="t in tabs" :key="t.key"
      :class="['tab-item', { active: currentTab === t.key }]"
      @click="switchTab(t.key)"
    >
      {{ t.icon }} {{ t.label }}
      <sup v-if="t.key === 'notifications' && unreadCount" class="unread-badge">{{ unreadCount }}</sup>
    </div>
  </div>

  <!-- 手机弹出菜单 -->
  <Teleport to="body">
    <Transition name="slide">
      <div v-if="isMobile && tabsVisible" class="mobile-menu-overlay" @click.self="tabsVisible = false">
        <div class="mobile-menu">
          <div class="mobile-menu-hd">
            <span>导航菜单</span>
            <button class="mobile-menu-close" @click="tabsVisible = false">&times;</button>
          </div>
          <div
            v-for="t in tabs" :key="t.key"
            :class="['mobile-menu-item', { active: currentTab === t.key }]"
            @click="switchTab(t.key)"
          >
            <span class="mobile-menu-icon">{{ t.icon }}</span>
            <span>{{ t.label }}</span>
            <sup v-if="t.key === 'notifications' && unreadCount" class="unread-badge">{{ unreadCount }}</sup>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- 内容区 -->
  <div class="content-wrap fade-in-up">
    <RouterView />
  </div>
</template>

<style scoped>
.hamburger {
  display: flex; flex-direction: column; gap: 4px;
  background: none; border: none; cursor: pointer; padding: 6px;
  flex-shrink: 0;
}
.hamburger span {
  display: block; width: 22px; height: 2px;
  background: #4A4A4A; border-radius: 2px; transition: all .2s;
}

.tabs {
  display: flex; gap: 4px; margin: 10px 0 4px;
  background: #F4F2EE; border-radius: 20px; padding: 6px;
  border: none; overflow-x: auto;
}
.tab-item {
  flex: 1; text-align: center; padding: 11px 10px; border-radius: 16px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.2s ease;
  color: var(--sub); white-space: nowrap; user-select: none;
}
.tab-item.active {
  background: #FFFFFF; color: var(--color-primary-dark, #D4893E);
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}
.unread-badge { color: var(--danger); font-size: 10px; }

.content-wrap {
  margin-top: 20px; padding: 28px 32px; min-height: 400px;
  background: #FFFFFF; border-radius: var(--radius-lg, 24px);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,.03));
}

@media (max-width: 767px) {
  .content-wrap {
    margin-top: 12px; padding: 14px 12px; border-radius: 16px; min-height: 300px;
  }
}

/* 手机弹出菜单 */
.mobile-menu-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,.35);
}
.mobile-menu {
  position: absolute; top: 0; left: 0; bottom: 0;
  width: 260px; max-width: 80vw;
  background: #fff; box-shadow: 4px 0 24px rgba(0,0,0,.10);
  display: flex; flex-direction: column; overflow-y: auto;
  border-radius: 0 20px 20px 0;
}
.mobile-menu-hd {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 20px; border-bottom: 1px solid #F0EDE8;
  font-size: 16px; font-weight: 700; color: #4A4A4A;
}
.mobile-menu-close {
  background: none; border: none; font-size: 24px;
  color: #B0B0B0; cursor: pointer; padding: 0 4px; line-height: 1;
}
.mobile-menu-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px; font-size: 15px; font-weight: 600;
  color: #4A4A4A; cursor: pointer; transition: background .15s;
  border-bottom: 1px solid #F9F8F6;
}
.mobile-menu-item:active { background: #FEF7EF; }
.mobile-menu-item.active { color: #D4893E; background: #FEF7EF; }
.mobile-menu-icon { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; }

.slide-enter-active { transition: all .25s ease; }
.slide-leave-active { transition: all .2s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; }
.slide-enter-from .mobile-menu { transform: translateX(-100%); }
.slide-leave-to .mobile-menu { transform: translateX(-100%); }
.slide-enter-to .mobile-menu, .slide-leave-from .mobile-menu { transform: translateX(0); }
.mobile-menu { transition: transform .25s ease; }
</style>
