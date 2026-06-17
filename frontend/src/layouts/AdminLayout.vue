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
  { key: 'orders', label: '订单管理', icon: '📋', path: '/admin/orders' },
  { key: 'studios', label: '项目管理', icon: '📦', path: '/admin/studios' },
  { key: 'styles_lib', label: '预设管理', icon: '🎨', path: '/admin/styles' },
  { key: 'create', label: '创建新项目', icon: '➕', path: '/admin/studio/create/step1' },
  { key: 'settings', label: '店铺设置', icon: '⚙️', path: '/admin/settings' },
  { key: 'notifications', label: '系统通知', icon: '🔔', path: '/admin/notifications' },
  { key: 'logs', label: '操作日志', icon: '📝', path: '/admin/logs' },
]

function switchTab(key) {
  currentTab.value = key
  tabsVisible.value = false
  const tab = tabs.find(t => t.key === key)
  if (tab) router.push(tab.path)
}

function isActive(key) {
  return currentTab.value === key
}

function logout() {
  storage.remove('mzg_admin_token')
  storage.remove('mzg_admin_mid')
  storage.remove('mzg_admin_shopname')
  storage.remove('mzg_admin_role')
  isLoggedIn.value = false
  router.push('/admin/login')
}

const isAdminUser = ref(false)
const token = storage.get('mzg_admin_token', '')
if (token) {
  isLoggedIn.value = true
  shopName.value = storage.get('mzg_admin_shopname', '')
  mId.value = storage.get('mzg_admin_mid', '')
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    isAdminUser.value = !!payload.isAdmin
  } catch {}
  const pathToTab = {
    '/admin/orders': 'orders', '/admin/studios': 'studios',
    '/admin/studio/create/step1': 'create', '/admin/studio/create/step2': 'create',
    '/admin/studio/create/step3': 'create',
    '/admin/styles': 'styles_lib',
    '/admin/settings': 'settings', '/admin/notifications': 'notifications', '/admin/logs': 'logs',
  }
  currentTab.value = pathToTab[route.path] || 'orders'
}

const customerOrderLink = computed(() => `${window.location.origin}/studios?mId=${mId.value}`)

// ── 刷新总线 ──
const refreshBus = useRefreshBus()
provide('refreshBus', refreshBus)

const copyBtnText = ref('复制下单链接')
const isCopying = ref(false)

async function handleCopyLink() {
  if (isCopying.value) return
  isCopying.value = true
  const link = customerOrderLink.value
  try {
    await navigator.clipboard.writeText(link)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = link
    ta.style.position = 'fixed'; ta.style.left = '-9999px'; ta.style.top = '-9999px'
    document.body.appendChild(ta)
    ta.focus(); ta.select()
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
      if (json.success || json.code === 0) {
        unreadCount.value = (json.data && json.data.count) || 0
      }
    } catch {}
  }
})
</script>

<template>
  <div class="admin-layout" :class="[
    { 'is-mobile': isMobile },
    'layout-' + layoutMode,
    { 'sidebar-collapsed': sidebarCollapsed },
  ]">
    <template v-if="!isLoggedIn">
      <RouterView />
    </template>

    <!-- ═══ 侧边栏布局（经典 / 科技） ═══ -->
    <div v-else-if="layoutMode === 'sidebar'" class="sidebar-shell">
      <aside class="app-sidebar" :style="{
        background: sidebar.bg,
        width: sidebarCollapsed ? '64px' : sidebar.width,
      }">
        <!-- Logo 区 -->
        <div class="sidebar-logo" @click="router.push('/admin/orders')">
          <span class="sidebar-logo-icon">🐱</span>
          <span v-show="!sidebarCollapsed" class="sidebar-logo-text" :style="{ color: sidebar.logoColor }">
            喵掌柜
          </span>
        </div>
        <div class="sidebar-divider" :style="{ background: sidebar.divider }"></div>

        <!-- 导航菜单 -->
        <nav class="sidebar-nav">
          <div
            v-for="t in tabs"
            :key="t.key"
            class="sidebar-nav-item"
            :class="{ active: isActive(t.key) }"
            :style="{
              color: isActive(t.key) ? sidebar.activeColor : sidebar.textColor,
              background: isActive(t.key) ? sidebar.activeBg : 'transparent',
            }"
            @click="switchTab(t.key)"
            @mouseenter="(e) => { if (!isActive(t.key)) e.currentTarget.style.background = sidebar.hoverBg }"
            @mouseleave="(e) => { if (!isActive(t.key)) e.currentTarget.style.background = 'transparent' }"
          >
            <span class="sidebar-nav-icon">{{ t.icon }}</span>
            <span v-show="!sidebarCollapsed" class="sidebar-nav-label">{{ t.label }}</span>
            <sup v-if="t.key === 'notifications' && unreadCount" class="sidebar-badge" :style="{ background: sidebar.activeColor }">{{ unreadCount }}</sup>
          </div>
        </nav>

        <!-- 底部操作 -->
        <div class="sidebar-bottom">
          <div class="sidebar-divider" :style="{ background: sidebar.divider }"></div>
          <div
            class="sidebar-nav-item sidebar-collapse-btn"
            :style="{ color: sidebar.textColor }"
            @click="sidebarCollapsed = !sidebarCollapsed"
            @mouseenter="(e) => { e.currentTarget.style.background = sidebar.hoverBg }"
            @mouseleave="(e) => { e.currentTarget.style.background = 'transparent' }"
          >
            <span class="sidebar-nav-icon">{{ sidebarCollapsed ? '▶' : '◀' }}</span>
            <span v-show="!sidebarCollapsed" class="sidebar-nav-label">收起菜单</span>
          </div>
          <div
            class="sidebar-nav-item sidebar-logout"
            :style="{ color: sidebar.textColor }"
            @click="logout"
            @mouseenter="(e) => { e.currentTarget.style.background = sidebar.hoverBg }"
            @mouseleave="(e) => { e.currentTarget.style.background = 'transparent' }"
          >
            <span class="sidebar-nav-icon">🚪</span>
            <span v-show="!sidebarCollapsed" class="sidebar-nav-label">退出登录</span>
          </div>
        </div>
      </aside>

      <!-- 右侧主区域 -->
      <div class="sidebar-main">
        <!-- 顶栏 -->
        <header class="sidebar-topbar" :style="{
          background: sidebar.bg,
        }">
          <div class="topbar-left">
            <button v-if="isMobile" class="hamburger" @click="tabsVisible = !tabsVisible" aria-label="菜单">
              <span></span><span></span><span></span>
            </button>
            <span class="topbar-title" :style="{ color: sidebar.logoColor }">{{ shopName || '喵掌柜后台' }}</span>
          </div>
          <div class="topbar-right">
            <span class="topbar-mid" :style="{ color: sidebar.textColor }">ID: {{ mId }}</span>
            <RefreshButton
              :on-refresh="async () => { refreshBus.trigger() }"
              :cooldown="3000"
              :timeout="15000"
            />
            <button v-if="isAdminUser" class="topbar-admin-btn" :style="{
              color: sidebar.activeColor, borderColor: sidebar.activeColor
            }" @click="router.push('/admin/dashboard')">⚙️ 超管</button>
          </div>
        </header>

        <!-- 下单链接 -->
        <div class="sidebar-linkbar" :style="{
          background: 'var(--bg-card, #161B22)',
          border: '1px solid var(--border-color, #21262D)',
        }">
          <span class="sidebar-link-label">客户下单</span>
          <span class="sidebar-link-text">{{ customerOrderLink }}</span>
          <el-button type="primary" size="small" round @click="handleCopyLink">{{ copyBtnText }}</el-button>
        </div>

        <!-- 内容区 -->
        <div class="sidebar-content fade-in-up">
          <RouterView />
        </div>
      </div>

      <!-- 手机弹出菜单 -->
      <Teleport to="body">
        <Transition name="slide">
          <div v-if="isMobile && tabsVisible" class="mobile-menu-overlay" @click.self="tabsVisible = false">
            <div class="mobile-menu" :style="{ background: sidebar.bg }">
              <div class="mobile-menu-hd" :style="{ color: sidebar.logoColor, borderColor: sidebar.divider }">
                <span>导航菜单</span>
                <button class="mobile-menu-close" @click="tabsVisible = false">&times;</button>
              </div>
              <div v-for="t in tabs" :key="t.key"
                   class="mobile-menu-item"
                   :class="{ active: isActive(t.key) }"
                   :style="{
                     color: isActive(t.key) ? sidebar.activeColor : sidebar.textColor,
                     background: isActive(t.key) ? sidebar.activeBg : 'transparent',
                     borderColor: sidebar.divider,
                   }"
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

    <!-- ═══ 顶部 Tab 布局（软萌） ═══ -->
    <div class="dashboard" v-else>
      <!-- 顶栏 -->
      <div class="header-admin">
        <div class="header-left">
          <button v-if="isMobile" class="hamburger" @click="tabsVisible = !tabsVisible" aria-label="菜单">
            <span></span><span></span><span></span>
          </button>
          <div class="header-info">
            <div class="header-title">{{ shopName || '喵掌柜后台' }}</div>
            <div class="header-mid">商家ID: <strong>{{ mId }}</strong></div>
          </div>
        </div>
        <div class="header-actions">
          <RefreshButton
            :on-refresh="async () => { refreshBus.trigger() }"
            :cooldown="3000"
            :timeout="15000"
          />
          <button v-if="isAdminUser" class="btn-admin-dash" @click="router.push('/admin/dashboard')">⚙️ 超管</button>
          <button class="btn-secondary btn-logout" @click="logout">退出</button>
        </div>
      </div>

      <!-- 客户下单链接 -->
      <div class="order-link-bar">
        <span class="link-label">客户下单</span>
        <span class="link-text">{{ customerOrderLink }}</span>
        <el-button type="primary" size="small" round @click="handleCopyLink">{{ copyBtnText }}</el-button>
      </div>

      <!-- 桌面：横向 tabs -->
      <div v-if="!isMobile" class="tabs">
        <div v-for="t in tabs" :key="t.key"
             :class="['tab-item', { active: isActive(t.key) }]"
             @click="switchTab(t.key)">
          {{ t.icon }} {{ t.label }}
          <sup v-if="t.key === 'notifications' && unreadCount" class="unread-badge">{{ unreadCount }}</sup>
        </div>
      </div>

      <!-- 手机弹出 -->
      <Teleport to="body">
        <Transition name="slide">
          <div v-if="isMobile && tabsVisible" class="mobile-menu-overlay" @click.self="tabsVisible = false">
            <div class="mobile-menu">
              <div class="mobile-menu-hd">
                <span>导航菜单</span>
                <button class="mobile-menu-close" @click="tabsVisible = false">&times;</button>
              </div>
              <div v-for="t in tabs" :key="t.key"
                   :class="['mobile-menu-item', { active: isActive(t.key) }]"
                   @click="switchTab(t.key)">
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
    </div>
  </div>
</template>

<style>
/* ═══════════════════════════════════════════════════════════════
   全局样式（非 scoped，作用于侧边栏动态背景）
   ═══════════════════════════════════════════════════════════════ */
.admin-layout {
  min-height: 100vh;
}

/* ═══ 侧边栏布局 ═══ */
.sidebar-shell {
  display: flex; min-height: 100vh; position: relative;
  background: var(--bg-page, #F0F0F0);
}

/* 侧边栏 */
.app-sidebar {
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 200;
  display: flex; flex-direction: column;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  user-select: none;
}

.sidebar-logo {
  display: flex; align-items: center; gap: 12px;
  padding: 20px 20px 16px; cursor: pointer;
  flex-shrink: 0;
}
.sidebar-logo-icon { font-size: 26px; line-height: 1; flex-shrink: 0; }
.sidebar-logo-text { font-size: 18px; font-weight: 700; white-space: nowrap; letter-spacing: 0.5px; }

.sidebar-divider {
  height: 1px; margin: 0 16px; flex-shrink: 0;
}

/* 导航区 */
.sidebar-nav {
  flex: 1; display: flex; flex-direction: column; gap: 2px;
  padding: 12px 8px; overflow-y: auto;
}
.sidebar-nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 12px; border-radius: 8px;
  font-size: 14px; font-weight: 500; cursor: pointer;
  transition: all 0.15s ease; white-space: nowrap;
  position: relative; min-height: 44px;
}
.sidebar-nav-item.active { font-weight: 600; }
.sidebar-nav-icon { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; line-height: 1; }
.sidebar-nav-label { overflow: hidden; text-overflow: ellipsis; }
.sidebar-badge {
  position: absolute; top: 8px; left: 30px;
  min-width: 18px; height: 18px; border-radius: 9px;
  color: #fff; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  padding: 0 5px; line-height: 1;
}

/* 底部操作 */
.sidebar-bottom {
  flex-shrink: 0; padding: 8px;
}
.sidebar-collapse-btn, .sidebar-logout {
  font-size: 13px; opacity: 0.7;
}

/* 右侧主区域 */
.sidebar-main {
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  transition: margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
/* 默认偏移 = 侧边栏宽度 */
.layout-sidebar .sidebar-main {
  margin-left: 230px;
}
.layout-sidebar.sidebar-collapsed .sidebar-main {
  margin-left: 64px;
}

/* 顶栏 */
.sidebar-topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 24px; flex-shrink: 0;
  border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.06));
  box-shadow: 0 1px 6px rgba(0,0,0,0.10);
  position: sticky; top: 0; z-index: 100;
}
.topbar-left { display: flex; align-items: center; gap: 12px; }
.topbar-title { font-size: 16px; font-weight: 600; white-space: nowrap; }
.topbar-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.topbar-mid { font-size: 12px; opacity: 0.7; }
.topbar-admin-btn {
  padding: 5px 14px; font-size: 12px; white-space: nowrap;
  border: 1px solid; border-radius: 6px; background: transparent;
  cursor: pointer; font-weight: 600; transition: all .15s;
}
.topbar-admin-btn:hover { opacity: 0.8; }

/* 下单链接 */
.sidebar-linkbar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 24px; flex-shrink: 0;
  flex-wrap: wrap;
}
.sidebar-link-label {
  font-size: 12px; color: var(--text-sub, #757575);
  font-weight: 600; white-space: nowrap; flex-shrink: 0;
}
.sidebar-link-text {
  flex: 1; min-width: 140px;
  font-size: 12px; font-family: var(--font-mono, 'SF Mono', monospace);
  color: var(--color-primary, #4DA8DA); opacity: 0.75;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* 内容区 */
.sidebar-content {
  flex: 1; padding: 24px 28px 40px; min-height: 400px;
}

/* ═══ 汉堡按钮（公共） ═══ */
.hamburger {
  display: flex; flex-direction: column; gap: 4px;
  background: none; border: none; cursor: pointer; padding: 6px;
  flex-shrink: 0;
}
.hamburger span {
  display: block; width: 22px; height: 2px;
  background: var(--text-primary, #4A4A4A); border-radius: 2px; transition: all .2s;
}

/* ═══ 顶部 Tab 布局（软萌） ═══ */
.dashboard {
  max-width: 1280px; margin: 0 auto;
  background: var(--bg-page, #F9F8F6);
  padding: 32px; border-radius: var(--radius-xl, 32px);
}
.header-admin {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; gap: 12px; flex-wrap: wrap;
  background: var(--bg-card, #FFFFFF);
  border-radius: 20px; padding: 16px 24px;
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,.03));
}
.header-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.header-info { min-width: 0; }
.header-title { font-size: 20px; font-weight: 700; color: var(--text-primary, #4A4A4A); white-space: nowrap; }
.header-mid { font-size: 12px; color: var(--text-sub, #8E8E8E); margin-top: 2px; }
.header-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.btn-logout { padding: 8px 18px; font-size: 13px; white-space: nowrap; }
.btn-admin-dash { padding:8px 18px; font-size:13px; white-space:nowrap; border:1px solid var(--border-color, #E8E5DF); border-radius:20px; background:var(--bg-card, #fff); cursor:pointer; color: var(--color-primary-dark, #D4893E); font-weight:600; }
.btn-admin-dash:hover { background: var(--color-peach-light, #FEF7EF); border-color: var(--color-primary, #F4A460); }

/* 下单链接栏 */
.order-link-bar {
  display: flex; align-items: center; gap: 12px;
  margin: 12px 0 8px; padding: 12px 18px;
  background: var(--bg-card, #FFFFFF); border-radius: 16px;
  border: 1px solid var(--border-color, #F0EDE8);
  box-shadow: 0 2px 10px rgba(0,0,0,0.03); flex-wrap: wrap;
}
.link-label { font-size: 12px; color: var(--text-sub, #8E8E8E); font-weight: 600; white-space: nowrap; flex-shrink: 0; }
.link-text {
  flex: 1; min-width: 140px;
  font-size: 12px; font-family: var(--font-mono, monospace);
  color: var(--color-primary, #F4A460); opacity: .70;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* 顶部 tabs */
.tabs {
  display: flex; gap: 4px; margin: 10px 0 4px;
  background: var(--color-disabled-bg, #F4F2EE); border-radius: 20px; padding: 6px;
  border: none; overflow-x: auto;
}
.tab-item {
  flex: 1; text-align: center; padding: 11px 10px; border-radius: 16px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
  color: var(--text-sub, #8E8E8E); white-space: nowrap; user-select: none;
}
.tab-item.active {
  background: var(--bg-card, #FFFFFF); color: var(--color-primary-dark, #D4893E);
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}
.unread-badge { color: var(--color-danger, #EFA8A8); font-size: 10px; }

/* 内容区 */
.content-wrap {
  margin-top: 20px; padding: 28px 32px; min-height: 400px;
  background: var(--bg-card, #FFFFFF); border-radius: var(--radius-lg, 24px);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,.03));
}

/* ═══ 手机弹出菜单（公共） ═══ */
.mobile-menu-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,.35);
}
.mobile-menu {
  position: absolute; top: 0; left: 0; bottom: 0;
  width: 280px; max-width: 80vw;
  box-shadow: 4px 0 24px rgba(0,0,0,.15);
  display: flex; flex-direction: column; overflow-y: auto;
  border-radius: 0 16px 16px 0;
  background: var(--bg-card, #fff);
}
.mobile-menu-hd {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 20px; font-size: 16px; font-weight: 700;
  border-bottom-style: solid; border-bottom-width: 1px;
  background: var(--bg-card, #fff);
}
.mobile-menu-close {
  background: none; border: none; font-size: 24px;
  color: #6F7985; cursor: pointer; padding: 0 4px; line-height: 1;
}
.mobile-menu-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px; font-size: 15px; font-weight: 600;
  cursor: pointer; transition: background .15s;
  border-bottom-style: solid; border-bottom-width: 1px;
}
.mobile-menu-icon { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; }

.slide-enter-active { transition: all .25s ease; }
.slide-leave-active { transition: all .2s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; }
.slide-enter-from .mobile-menu { transform: translateX(-100%); }
.slide-leave-to .mobile-menu { transform: translateX(-100%); }
.slide-enter-to .mobile-menu, .slide-leave-from .mobile-menu { transform: translateX(0); }
.mobile-menu { transition: transform .25s ease; }

/* ═══ 响应式 ═══ */
@media (max-width: 1023px) {
  .layout-sidebar .sidebar-main { margin-left: 64px; }
  .app-sidebar { width: 64px !important; }
  .app-sidebar .sidebar-logo-text,
  .app-sidebar .sidebar-nav-label,
  .app-sidebar .sidebar-collapse-btn .sidebar-nav-label,
  .app-sidebar .sidebar-logout .sidebar-nav-label { display: none; }
  .app-sidebar .sidebar-logo { justify-content: center; padding: 20px 8px 16px; }
  .app-sidebar .sidebar-nav-item { justify-content: center; padding: 11px 8px; }
  .app-sidebar .sidebar-divider { margin: 0 12px; }
}

@media (max-width: 767px) {
  /* ── 侧边栏布局手机端 ── */
  .layout-sidebar .sidebar-main { margin-left: 0; }
  .app-sidebar { display: none; }

  /* 侧边栏 topbar 手机适配 */
  .sidebar-topbar {
    padding: 10px 14px; flex-wrap: wrap; gap: 8px;
  }
  .sidebar-topbar .topbar-title { font-size: 14px; }
  .sidebar-topbar .topbar-mid { display: none; }
  .sidebar-topbar .topbar-right { gap: 8px; }
  .sidebar-topbar .topbar-admin-btn { padding: 4px 10px; font-size: 11px; }

  /* 下单链接 */
  .sidebar-linkbar { padding: 8px 14px; gap: 8px; }
  .sidebar-linkbar .sidebar-link-label { font-size: 11px; }
  .sidebar-linkbar .sidebar-link-text { font-size: 10px; min-width: 0; }

  /* 内容区 */
  .sidebar-content {
    padding: 12px 10px 24px; min-height: 300px;
  }

  /* ── 汉堡按钮在科技经典手机端显示 ── */
  .layout-sidebar.is-mobile .hamburger { display: flex; }

  /* ── 顶部布局手机端 ── */
  .header-admin {
    padding: 12px 14px; border-radius: 16px; margin-bottom: 10px;
    flex-direction: column; align-items: stretch; gap: 10px;
  }
  .header-admin .header-left { gap: 8px; }
  .header-admin .header-actions {
    justify-content: flex-end; flex-wrap: wrap;
  }
  .header-title { font-size: 16px; }
  .header-mid { font-size: 11px; }
  .btn-logout { padding: 6px 14px; font-size: 12px; }
  .btn-admin-dash { padding: 4px 10px; font-size: 11px; }

  .order-link-bar {
    padding: 10px 14px; gap: 8px; margin: 8px 0 4px;
  }
  .link-text { font-size: 11px; }

  /* tabs 可滑动 */
  .tabs {
    gap: 2px; border-radius: 16px; padding: 4px; overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar { display: none; }
  .tab-item {
    padding: 8px 8px; font-size: 12px; flex-shrink: 0;
    border-radius: 14px; min-width: fit-content;
  }

  .content-wrap {
    margin-top: 12px; padding: 14px 12px; border-radius: 16px; min-height: 300px;
  }
  .dashboard { padding: 8px !important; }

  /* 手机弹出菜单 */
  .mobile-menu {
    width: 100%; max-width: 85vw;
    border-radius: 0 16px 16px 0;
  }
  .mobile-menu-hd { padding: 14px 18px; }
  .mobile-menu-item { padding: 12px 18px; font-size: 14px; }
}

/* 小屏折叠状态下：导航文字隐藏，纯图标模式 */
@media (max-width: 1023px) and (min-width: 768px) {
  .app-sidebar:not(:hover) .sidebar-nav-item {
    justify-content: center; padding: 11px 8px;
  }
  /* hover 展开 */
  .app-sidebar:hover {
    width: 230px !important; z-index: 210;
    box-shadow: 4px 0 30px rgba(0,0,0,.25);
  }
}

.mobile-menu-close { color: inherit; opacity: 0.6; }
</style>
