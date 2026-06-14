<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { storage } from '@/utils/storage'
import { ElMessage } from 'element-plus'
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

function logout() {
  storage.remove('mzg_admin_token')
  storage.remove('mzg_admin_mid')
  storage.remove('mzg_admin_shopname')
  isLoggedIn.value = false
  router.push('/admin/login')
}

const token = storage.get('mzg_admin_token', '')
if (token) {
  isLoggedIn.value = true
  shopName.value = storage.get('mzg_admin_shopname', '')
  mId.value = storage.get('mzg_admin_mid', '')
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
async function handleCopyLink() {
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
  setTimeout(() => { copyBtnText.value = '复制下单链接' }, 2000)
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
          {{ t.icon }} {{ t.label }}
          <sup v-if="t.key === 'notifications' && unreadCount" class="unread-badge">{{ unreadCount }}</sup>
        </div>
      </div>

      <!-- 手机：弹出菜单 -->
      <Teleport to="body">
        <Transition name="slide">
          <div v-if="isMobile && tabsVisible" class="mobile-menu-overlay" @click.self="tabsVisible = false">
            <div class="mobile-menu">
              <div class="mobile-menu-hd">
                <span>导航菜单</span>
                <button class="mobile-menu-close" @click="tabsVisible = false">&times;</button>
              </div>
              <div v-for="t in tabs" :key="t.key"
                   :class="['mobile-menu-item', { active: currentTab === t.key }]"
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

<style scoped>
/* ── 顶栏 ── */
.header-admin {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
  background: #FFFFFF;
  border-radius: 20px;
  padding: 16px 24px;
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,.03));
}
.header-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.header-info { min-width: 0; }
.header-title { font-size: 20px; font-weight: 700; color: var(--text); white-space: nowrap; }
.header-mid { font-size: 12px; color: var(--sub); margin-top: 2px; }
.header-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.btn-logout { padding: 8px 18px; font-size: 13px; white-space: nowrap; }

/* 汉堡按钮 */
.hamburger {
  display: flex; flex-direction: column; gap: 4px;
  background: none; border: none; cursor: pointer; padding: 6px;
  flex-shrink: 0;
}
.hamburger span {
  display: block; width: 22px; height: 2px;
  background: #4A4A4A; border-radius: 2px; transition: all .2s;
}

/* ── 下单链接栏 ── */
.order-link-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0 8px;
  padding: 12px 18px;
  background: #FFFFFF;
  border-radius: 16px;
  border: 1px solid #F0EDE8;
  box-shadow: 0 2px 10px rgba(0,0,0,0.03);
  flex-wrap: wrap;
}
.link-label {
  font-size: 12px; color: var(--text-sub, #8E8E8E);
  font-weight: 600; white-space: nowrap; flex-shrink: 0;
}
.link-text {
  flex: 1; min-width: 140px;
  font-size: 12px; font-family: var(--font-mono, 'SF Mono', 'Cascadia Code', monospace);
  color: var(--color-primary, #F4A460); opacity: .70;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── 桌面 tabs ── */
.tabs {
  display: flex; gap: 4px; margin: 10px 0 4px;
  background: #F4F2EE; border-radius: 20px; padding: 6px;
  border: none; overflow-x: auto;
}
.tab-item {
  flex: 1; text-align: center; padding: 11px 10px; border-radius: 16px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
  color: var(--sub); white-space: nowrap; user-select: none;
}
.tab-item.active {
  background: #FFFFFF; color: var(--color-primary-dark, #D4893E);
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}
.unread-badge { color: var(--danger); font-size: 10px; }

/* ── 内容区 ── */
.content-wrap {
  margin-top: 20px; padding: 28px 32px; min-height: 400px;
  background: #FFFFFF; border-radius: var(--radius-lg, 24px);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,.03));
}

/* ═══════════════════════════════════════════
   手机端覆盖 (< 768px)
   ═══════════════════════════════════════════ */
@media (max-width: 767px) {
  .header-admin {
    padding: 12px 14px; border-radius: 16px; margin-bottom: 10px;
  }
  .header-title { font-size: 16px; }
  .header-mid { font-size: 11px; }
  .btn-logout { padding: 6px 14px; font-size: 12px; }

  .order-link-bar {
    padding: 10px 14px; gap: 8px; margin: 8px 0 4px;
  }
  .link-text { font-size: 11px; }

  .content-wrap {
    margin-top: 12px; padding: 14px 12px; border-radius: 16px; min-height: 300px;
  }

  .dashboard { padding: 8px !important; }
}

/* ── 手机弹出菜单 ── */
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
