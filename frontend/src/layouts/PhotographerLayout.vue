<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { storage } from '@/utils/storage'
import { ElMessage } from 'element-plus'
import { useThemeStore } from '@/stores/theme'
import { useRefreshBus } from '@/composables/useRefreshBus'
import RefreshButton from '@/components/shared/RefreshButton.vue'

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()

const isLoggedIn = ref(false)
const shopName = ref('')
const mId = ref('')
const userRole = ref('photographer')
const unreadCount = ref(0)

const currentTab = ref('orders')
const tabsVisible = ref(false)
const isMobile = ref(false)
const sidebarCollapsed = ref(false)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

const layoutMode = computed(() => themeStore.currentLayout)
const sidebar = computed(() => themeStore.currentSidebar)

function onResize() {
  windowWidth.value = window.innerWidth
  isMobile.value = windowWidth.value < 768
  if (windowWidth.value >= 768) tabsVisible.value = false
  if (windowWidth.value < 1024 && !isMobile.value) sidebarCollapsed.value = true
  else if (windowWidth.value >= 1024) sidebarCollapsed.value = false
}
onMounted(() => { window.addEventListener('resize', onResize); onResize() })
onUnmounted(() => { window.removeEventListener('resize', onResize) })

const tabs = [
  { key: 'orders', label: '拍摄订单', icon: '📋', path: '/photo/orders' },
  { key: 'studios', label: '作品集', icon: '📷', path: '/photo/studios' },
  { key: 'styles_lib', label: '风格预设', icon: '🎨', path: '/photo/styles' },
  { key: 'create', label: '发布作品', icon: '✨', path: '/photo/studio/create/step1' },
  { key: 'settings', label: '店铺设置', icon: '⚙️', path: '/photo/settings' },
  { key: 'notifications', label: '系统通知', icon: '🔔', path: '/photo/notifications' },
  { key: 'logs', label: '操作日志', icon: '📝', path: '/photo/logs' },
]

function switchTab(key) {
  currentTab.value = key
  tabsVisible.value = false
  const tab = tabs.find(t => t.key === key)
  if (tab) router.push(tab.path)
}

function isActive(key) { return currentTab.value === key }

function logout() {
  storage.remove('mzg_photo_token')
  storage.remove('mzg_photo_mid')
  storage.remove('mzg_photo_shopname')
  storage.remove('mzg_photo_role')
  isLoggedIn.value = false
  router.push('/admin/login')
}

const isAdminUser = ref(false)
const token = storage.get('mzg_photo_token', '')
if (token) {
  isLoggedIn.value = true
  shopName.value = storage.get('mzg_photo_shopname', '')
  mId.value = storage.get('mzg_photo_mid', '')
  userRole.value = storage.get('mzg_photo_role', 'photographer')
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    isAdminUser.value = !!payload.isAdmin
  } catch {}
  const pathToTab = {
    '/photo/orders': 'orders', '/photo/studios': 'studios',
    '/photo/studio/create/step1': 'create', '/photo/studio/create/step2': 'create',
    '/photo/studio/create/step3': 'create',
    '/photo/styles': 'styles_lib',
    '/photo/settings': 'settings', '/photo/notifications': 'notifications', '/photo/logs': 'logs',
  }
  currentTab.value = pathToTab[route.path] || 'orders'
}

const customerOrderLink = computed(() => `${window.location.origin}/studios?mId=${mId.value}`)

const refreshBus = useRefreshBus()
provide('refreshBus', refreshBus)

const copyBtnText = ref('复制下单链接')
const isCopying = ref(false)

async function handleCopyLink() {
  if (isCopying.value) return
  isCopying.value = true
  const link = customerOrderLink.value
  try { await navigator.clipboard.writeText(link) } catch {
    const ta = document.createElement('textarea')
    ta.value = link; ta.style.position = 'fixed'; ta.style.left = '-9999px'; ta.style.top = '-9999px'
    document.body.appendChild(ta); ta.focus(); ta.select()
    try { document.execCommand('copy') } catch {}
    document.body.removeChild(ta)
  }
  copyBtnText.value = '已复制'
  ElMessage.success('下单链接已复制')
  setTimeout(() => { copyBtnText.value = '复制下单链接'; isCopying.value = false }, 2000)
}

onMounted(async () => {
  if (isLoggedIn.value) {
    try {
      const res = await fetch(`/api/notifications/unread?mId=${mId.value}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success || json.code === 0) unreadCount.value = (json.data && json.data.count) || 0
    } catch {}
  }
})
</script>

<template>
  <div class="admin-layout photo-layout" :class="[
    { 'is-mobile': isMobile },
    'layout-' + layoutMode,
    { 'sidebar-collapsed': sidebarCollapsed },
  ]">
    <template v-if="!isLoggedIn">
      <RouterView />
    </template>

    <!-- ═══ 侧边栏布局 ═══ -->
    <div v-else-if="layoutMode === 'sidebar'" class="sidebar-shell">
      <aside class="app-sidebar" :style="{ background: sidebar.bg, width: sidebarCollapsed ? '64px' : sidebar.width }">
        <div class="sidebar-logo" @click="router.push('/photo/orders')">
          <span class="sidebar-logo-icon">📷</span>
          <span v-show="!sidebarCollapsed" class="sidebar-logo-text" :style="{ color: sidebar.logoColor }">摄影后台</span>
        </div>
        <div class="sidebar-divider" :style="{ background: sidebar.divider }"></div>
        <nav class="sidebar-nav">
          <div v-for="t in tabs" :key="t.key"
               class="sidebar-nav-item" :class="{ active: isActive(t.key) }"
               :style="{ color: isActive(t.key) ? sidebar.activeColor : sidebar.textColor, background: isActive(t.key) ? sidebar.activeBg : 'transparent' }"
               @click="switchTab(t.key)"
               @mouseenter="(e) => { if (!isActive(t.key)) e.currentTarget.style.background = sidebar.hoverBg }"
               @mouseleave="(e) => { if (!isActive(t.key)) e.currentTarget.style.background = 'transparent' }">
            <span class="sidebar-nav-icon">{{ t.icon }}</span>
            <span v-show="!sidebarCollapsed" class="sidebar-nav-label">{{ t.label }}</span>
            <sup v-if="t.key === 'notifications' && unreadCount" class="sidebar-badge" :style="{ background: sidebar.activeColor }">{{ unreadCount }}</sup>
          </div>
        </nav>
        <div class="sidebar-bottom">
          <div class="sidebar-divider" :style="{ background: sidebar.divider }"></div>
          <div class="sidebar-nav-item sidebar-collapse-btn" :style="{ color: sidebar.textColor }"
               @click="sidebarCollapsed = !sidebarCollapsed"
               @mouseenter="(e) => { e.currentTarget.style.background = sidebar.hoverBg }"
               @mouseleave="(e) => { e.currentTarget.style.background = 'transparent' }">
            <span class="sidebar-nav-icon">{{ sidebarCollapsed ? '▶' : '◀' }}</span>
            <span v-show="!sidebarCollapsed" class="sidebar-nav-label">收起菜单</span>
          </div>
          <div class="sidebar-nav-item sidebar-logout" :style="{ color: sidebar.textColor }"
               @click="logout"
               @mouseenter="(e) => { e.currentTarget.style.background = sidebar.hoverBg }"
               @mouseleave="(e) => { e.currentTarget.style.background = 'transparent' }">
            <span class="sidebar-nav-icon">🚪</span>
            <span v-show="!sidebarCollapsed" class="sidebar-nav-label">退出登录</span>
          </div>
        </div>
      </aside>

      <div class="sidebar-main">
        <header class="sidebar-topbar" :style="{ background: sidebar.bg }">
          <div class="topbar-left">
            <button v-if="isMobile" class="hamburger" @click="tabsVisible = !tabsVisible" aria-label="菜单">
              <span></span><span></span><span></span>
            </button>
            <span class="topbar-title" :style="{ color: sidebar.logoColor }">📷 {{ shopName || '摄影后台' }}</span>
          </div>
          <div class="topbar-right">
            <span class="topbar-mid" :style="{ color: sidebar.textColor }">ID: {{ mId }}</span>
            <RefreshButton :on-refresh="async () => { refreshBus.trigger() }" :cooldown="3000" :timeout="15000" />
            <button v-if="isAdminUser" class="topbar-admin-btn" :style="{ color: sidebar.activeColor, borderColor: sidebar.activeColor }" @click="router.push('/admin/dashboard')">⚙️ 超管</button>
          </div>
        </header>

        <div class="sidebar-linkbar" :style="{ background: 'var(--bg-card, #161B22)', border: '1px solid var(--border-color, #21262D)' }">
          <span class="sidebar-link-label">客户下单</span>
          <span class="sidebar-link-text">{{ customerOrderLink }}</span>
          <el-button type="primary" size="small" round @click="handleCopyLink">{{ copyBtnText }}</el-button>
        </div>

        <div class="sidebar-content fade-in-up">
          <RouterView />
        </div>
      </div>

      <Teleport to="body">
        <Transition name="slide">
          <div v-if="isMobile && tabsVisible" class="mobile-menu-overlay" @click.self="tabsVisible = false">
            <div class="mobile-menu" :style="{ background: sidebar.bg }">
              <div class="mobile-menu-hd" :style="{ color: sidebar.logoColor, borderColor: sidebar.divider }">
                <span>导航菜单</span>
                <button class="mobile-menu-close" @click="tabsVisible = false">&times;</button>
              </div>
              <div v-for="t in tabs" :key="t.key" class="mobile-menu-item"
                   :class="{ active: isActive(t.key) }"
                   :style="{ color: isActive(t.key) ? sidebar.activeColor : sidebar.textColor, background: isActive(t.key) ? sidebar.activeBg : 'transparent', borderColor: sidebar.divider }"
                   @click="switchTab(t.key)">
                <span class="mobile-menu-icon">{{ t.icon }}</span>
                <span>{{ t.label }}</span>
                <sup v-if="t.key === 'notifications' && unreadCount" class="sidebar-badge" :style="{ background: sidebar.activeColor }">{{ unreadCount }}</sup>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>

    <!-- ═══ 顶部 Tab 布局 ═══ -->
    <div class="dashboard" v-else>
      <div class="header-admin">
        <div class="header-left">
          <button v-if="isMobile" class="hamburger" @click="tabsVisible = !tabsVisible" aria-label="菜单">
            <span></span><span></span><span></span>
          </button>
          <div class="header-info">
            <div class="header-title">📷 {{ shopName || '摄影后台' }}</div>
            <div class="header-mid">商家ID: <strong>{{ mId }}</strong></div>
          </div>
        </div>
        <div class="header-actions">
          <RefreshButton :on-refresh="async () => { refreshBus.trigger() }" :cooldown="3000" :timeout="15000" />
          <button v-if="isAdminUser" class="btn-admin-dash" @click="router.push('/admin/dashboard')">⚙️ 超管</button>
          <button class="btn-secondary btn-logout" @click="logout">退出</button>
        </div>
      </div>

      <div class="order-link-bar">
        <span class="link-label">客户下单</span>
        <span class="link-text">{{ customerOrderLink }}</span>
        <el-button type="primary" size="small" round @click="handleCopyLink">{{ copyBtnText }}</el-button>
      </div>

      <div v-if="!isMobile" class="tabs">
        <div v-for="t in tabs" :key="t.key" :class="['tab-item', { active: isActive(t.key) }]" @click="switchTab(t.key)">
          {{ t.icon }} {{ t.label }}
          <sup v-if="t.key === 'notifications' && unreadCount" class="unread-badge">{{ unreadCount }}</sup>
        </div>
      </div>

      <Teleport to="body">
        <Transition name="slide">
          <div v-if="isMobile && tabsVisible" class="mobile-menu-overlay" @click.self="tabsVisible = false">
            <div class="mobile-menu">
              <div class="mobile-menu-hd">
                <span>导航菜单</span>
                <button class="mobile-menu-close" @click="tabsVisible = false">&times;</button>
              </div>
              <div v-for="t in tabs" :key="t.key" :class="['mobile-menu-item', { active: isActive(t.key) }]" @click="switchTab(t.key)">
                <span class="mobile-menu-icon">{{ t.icon }}</span><span>{{ t.label }}</span>
                <sup v-if="t.key === 'notifications' && unreadCount" class="unread-badge">{{ unreadCount }}</sup>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <div class="content-wrap fade-in-up"><RouterView /></div>
    </div>
  </div>
</template>
