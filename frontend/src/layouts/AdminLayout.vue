<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { storage } from '@/utils/storage'
import { ElMessage } from 'element-plus'
import { Brush, List, FolderOpened, Plus, Setting, Bell, Document } from '@element-plus/icons-vue'
import logoIcon from '@/assets/images/logo-icon.svg?raw'
import logoHorizontal from '@/assets/images/logo-horizontal.svg?raw'
import { useRefreshBus } from '@/composables/useRefreshBus'
import RefreshButton from '@/components/shared/RefreshButton.vue'

const router = useRouter()
const route = useRoute()
const isLoggedIn = ref(false)
const shopName = ref('')
const mId = ref('')
const unreadCount = ref(0)

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

// icon 存的是组件引用而非 emoji —— emoji 在不同系统/字体下形态和颜色不可控，
// 无法参与主题色体系（见《设计需求文档》的图标规范）。
const tabs = [
  { key: 'styles_lib', label: '预设', icon: Brush },
  { key: 'orders', label: '订单', icon: List },
  { key: 'studios', label: '项目', icon: FolderOpened },
  { key: 'create', label: '创建', icon: Plus },
  { key: 'settings', label: '设置', icon: Setting },
  { key: 'notifications', label: '通知', icon: Bell },
  { key: 'logs', label: '日志', icon: Document },
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

function logout() {
  storage.remove('mzg_admin_token')
  storage.remove('mzg_admin_mid')
  storage.remove('mzg_admin_shopname')
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
    '/admin/styles': 'styles_lib', '/admin/styles/create': 'styles_lib',
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
    try { document.execCommand('copy') } catch { /* 静默 */ }
    document.body.removeChild(ta)
  }
  copyBtnText.value = '已复制'
  ElMessage.success('下单链接已复制')
  setTimeout(() => {
    copyBtnText.value = '复制下单链接'
    isCopying.value = false
  }, 2000)
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
  <div class="admin-layout" :class="{ 'is-mobile': isMobile }">
    <template v-if="!isLoggedIn">
      <RouterView />
    </template>

    <div class="dashboard" v-else>
      <!-- 顶栏 -->
      <div class="header-admin">
        <div class="header-left">
          <button v-if="isMobile" class="hamburger" @click="tabsVisible = !tabsVisible" aria-label="菜单">
            <span></span><span></span><span></span>
          </button>
          <!-- 品牌标：商家名是商家自己的身份，不能替换，所以用猫头标做前缀 -->
          <span class="header-brand" v-html="logoIcon" aria-hidden="true"></span>
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
          <button v-if="isAdminUser" class="btn-admin-dash" @click="router.push('/admin/dashboard')">
            <el-icon><Setting /></el-icon> 超管
          </button>
          <button class="btn-secondary btn-logout" @click="logout">退出</button>
        </div>
      </div>

      <!-- 客户下单链接 -->
      <div class="order-link-bar">
        <span class="link-label">客户下单</span>
        <span class="link-text">{{ customerOrderLink }}</span>
        <el-button type="primary" size="small" round @click="handleCopyLink">
          {{ copyBtnText }}
        </el-button>
      </div>

      <!-- 桌面/平板：横向 tabs -->
      <div v-if="!isMobile" class="tabs">
        <div v-for="t in tabs" :key="t.key"
             :class="['tab-item', { active: currentTab === t.key }]"
             @click="switchTab(t.key)">
          <el-icon class="tab-icon"><component :is="t.icon" /></el-icon>
          <span>{{ t.label }}</span>
          <sup v-if="t.key === 'notifications' && unreadCount" class="unread-badge">{{ unreadCount }}</sup>
        </div>
      </div>

      <!-- 手机：弹出菜单 -->
      <Teleport to="body">
        <Transition name="slide">
          <div v-if="isMobile && tabsVisible" class="mobile-menu-overlay" @click.self="tabsVisible = false">
            <div class="mobile-menu">
              <div class="mobile-menu-hd">
                <span class="mobile-menu-brand" v-html="logoHorizontal"></span>
                <button class="mobile-menu-close" @click="tabsVisible = false" aria-label="关闭菜单">&times;</button>
              </div>
              <div v-for="t in tabs" :key="t.key"
                   :class="['mobile-menu-item', { active: currentTab === t.key }]"
                   @click="switchTab(t.key)">
                <span class="mobile-menu-icon"><el-icon><component :is="t.icon" /></el-icon></span>
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

<style scoped>
/* ── 顶栏 ── */
.header-admin {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--surface-1);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-hairline);
  border-radius: var(--radius-panel);
  padding: var(--space-4) var(--space-6);
  box-shadow: var(--shadow-2), var(--glass-highlight);
}
.header-left { display: flex; align-items: center; gap: var(--space-3); flex: 1; min-width: 0; }
.header-brand { display: inline-flex; width: 32px; height: 32px; flex-shrink: 0; }
.header-brand :deep(svg) { width: 100%; height: 100%; display: block; }
.header-info { min-width: 0; }
.header-title { font-size: 20px; font-weight: 700; color: var(--text-1); white-space: nowrap; }
.header-mid { font-size: 12px; color: var(--text-3); margin-top: 2px; }
.header-actions { display: flex; gap: var(--space-2); align-items: center; flex-shrink: 0; }
.btn-logout { white-space: nowrap; }
.btn-admin-dash {
  display: inline-flex; align-items: center; gap: 5px;
  height: 32px; padding: 0 16px; font-size: 13px; white-space: nowrap;
  border: 1px solid var(--border-color); border-radius: var(--radius-btn);
  background: var(--surface-solid); cursor: pointer;
  color: var(--color-primary-ink); font-family: inherit; font-weight: 600;
  transition: background-color var(--duration-1) var(--ease-out),
              border-color var(--duration-1) var(--ease-out);
}
.btn-admin-dash:hover { background: var(--color-primary-tint); border-color: var(--color-primary); }

/* 汉堡按钮 */
.hamburger {
  display: flex; flex-direction: column; gap: 4px;
  background: none; border: none; cursor: pointer; padding: 6px;
  flex-shrink: 0;
}
.hamburger span {
  display: block; width: 22px; height: 2px;
  background: var(--text-1); border-radius: 2px; transition: all .2s;
}

/* ── 下单链接栏 ── */
.order-link-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: var(--space-3) 0 var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--surface-1);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border-radius: var(--radius-card);
  border: 1px solid var(--glass-hairline);
  box-shadow: var(--shadow-1);
  flex-wrap: wrap;
}
.link-label {
  font-size: 12px; color: var(--text-3);
  font-weight: 600; white-space: nowrap; flex-shrink: 0;
}
.link-text {
  flex: 1; min-width: 140px;
  font-size: 12px; font-family: var(--font-mono);
  color: var(--color-primary-ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── 桌面 tabs ── */
.tabs {
  display: flex; gap: 4px; margin: var(--space-3) 0 var(--space-1);
  background: var(--bg-sunken);
  border: 1px solid var(--glass-hairline);
  border-radius: var(--radius-lg); padding: 5px;
  overflow-x: auto;
}
.tab-item {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  text-align: center; padding: 9px 12px; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background-color var(--duration-1) var(--ease-out),
              color var(--duration-1) var(--ease-out);
  color: var(--text-3); white-space: nowrap; user-select: none;
}
.tab-item:hover { color: var(--text-1); }
.tab-item.active {
  background: var(--surface-solid); color: var(--color-primary-ink);
  box-shadow: var(--shadow-1);
}
.tab-icon { font-size: 15px; }
.unread-badge { color: var(--color-danger-ink); font-size: 10px; font-weight: 700; }

/* ── 内容区 ──
   这里放的是表格与密集数据，用 --surface-solid 而非磨砂：
   文字密集区域透出背景只会增加阅读负担，磨砂留给周围的面板。 */
.content-wrap {
  margin-top: var(--space-5); padding: var(--space-6); min-height: 400px;
  background: var(--surface-solid);
  border: 1px solid var(--glass-hairline);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-1);
}

/* ═══════════════════════════════════════════
   手机端覆盖 (< 768px)
   ═══════════════════════════════════════════ */
@media (max-width: 767px) {
  .header-admin {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-card);
    margin-bottom: var(--space-3);
  }
  .header-title { font-size: 16px; }
  .header-mid { font-size: 11px; }
  .btn-logout, .btn-admin-dash { height: 30px; padding: 0 12px; font-size: 12px; }

  .order-link-bar {
    padding: var(--space-3) var(--space-4); gap: var(--space-2);
    margin: var(--space-2) 0 var(--space-1);
  }
  .link-text { font-size: 11px; }

  .content-wrap {
    margin-top: var(--space-3); padding: var(--space-4) var(--space-3);
    border-radius: var(--radius-card); min-height: 300px;
  }
  .tab-item { flex: 0 0 auto; padding: 8px 14px; }
}

/* ── 手机弹出菜单 ──
   z-index 从 2000 降到 --z-overlay(1500)：2000 与 Element Plus 弹层同层，
   会导致「菜单盖住对话框」或反之的不确定行为。自定义层必须低于 EP。 */
.mobile-menu-overlay {
  position: fixed; inset: 0; z-index: var(--z-overlay);
  background: rgba(74,70,66,.35);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}
.mobile-menu {
  position: absolute; top: 0; left: 0; bottom: 0;
  width: 260px; max-width: 80vw;
  background: var(--surface-2);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  box-shadow: 4px 0 24px rgba(74,70,66,.12);
  display: flex; flex-direction: column; overflow-y: auto;
  border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
}
.mobile-menu-hd {
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 16px; font-weight: 700; color: var(--text-1);
}
.mobile-menu-brand { display: inline-flex; height: 28px; line-height: 0; }
.mobile-menu-brand :deep(svg) { height: 28px; width: auto; display: block; }
.mobile-menu-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  background: none; border: none; font-size: 22px;
  color: var(--text-3); cursor: pointer; padding: 0; line-height: 1;
  transition: background-color var(--duration-1) var(--ease-out);
}
.mobile-menu-close:hover { background: var(--color-primary-tint); color: var(--text-1); }
.mobile-menu-item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-4) var(--space-5); font-size: 15px; font-weight: 600;
  color: var(--text-1); cursor: pointer;
  transition: background-color var(--duration-1) var(--ease-out);
  border-bottom: 1px solid var(--border-subtle);
}
.mobile-menu-item:active { background: var(--color-primary-tint); }
.mobile-menu-item.active { color: var(--color-primary-ink); background: var(--color-primary-tint); }
.mobile-menu-icon {
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 18px; width: 24px; flex-shrink: 0; color: var(--text-2);
}
.mobile-menu-item.active .mobile-menu-icon { color: var(--color-primary-ink); }

.slide-enter-active { transition: opacity var(--duration-2) var(--ease-out); }
.slide-leave-active { transition: opacity var(--duration-2) var(--ease-out); }
.slide-enter-from, .slide-leave-to { opacity: 0; }
.slide-enter-from .mobile-menu { transform: translateX(-100%); }
.slide-leave-to .mobile-menu { transform: translateX(-100%); }
.slide-enter-to .mobile-menu, .slide-leave-from .mobile-menu { transform: translateX(0); }
.mobile-menu { transition: transform var(--duration-2) var(--ease-out); }
</style>
