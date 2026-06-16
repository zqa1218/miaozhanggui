import { createRouter, createWebHistory } from 'vue-router'
import { storage } from '@/utils/storage'

function getAdminToken() {
  return storage.get('mzg_admin_token', '')
}

function getClientToken() {
  return storage.get('mzg_client_token', '')
}

const routes = [
  // ==================== C端前台（ClientLayout 包裹） ====================
  {
    path: '/',
    component: () => import('@/layouts/ClientLayout.vue'),
    children: [
      { path: '', redirect: to => ({ path: '/studios', query: to.query }) },
      { path: 'studios', name: 'StudioList', component: () => import('@/views/studio/StudioList.vue') },
      { path: 'studios/:id', name: 'StudioDetail', component: () => import('@/views/studio/StudioDetail.vue') },
      { path: 'styles', name: 'StyleList', component: () => import('@/views/style/StyleList.vue') },
      { path: 'booking/:studioId', name: 'Window_C_Step1', component: () => import('@/views/client/Window_C_Step1.vue'), meta: { requiresClientAuth: true } },
      { path: 'booking/:studioId/step2', name: 'Window_C_Step2', component: () => import('@/views/client/Window_C_Step2.vue'), meta: { requiresClientAuth: true } },
      { path: 'my-orders', name: 'MyOrders', component: () => import('@/views/client/MyOrdersView.vue'), meta: { requiresClientAuth: true } },
      { path: 'my-orders/:id', name: 'OrderDetail', component: () => import('@/views/client/OrderDetailView.vue'), meta: { requiresClientAuth: true } },
    ],
  },
  // 客户端登录页（独立布局，无底部导航）
  {
    path: '/login',
    name: 'ClientLogin',
    component: () => import('@/views/client/LoginView.vue'),
  },
  // 注册邀请链接 → 重定向到商家注册页并携带邀请码
  {
    path: '/register',
    redirect: to => ({ path: '/admin/login', query: to.query }),
  },

  // ==================== B端后台（AdminLayout 包裹） ====================
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    children: [
      { path: '', redirect: '/admin/orders' },
      { path: 'login', name: 'AdminLogin', component: () => import('@/views/admin/LoginView.vue') },
      { path: 'dashboard', name: 'SuperAdmin', component: () => import('@/views/admin/SuperAdminDashboard.vue'), meta: { requiresAuth: true } },

      // 订单管理 ★
      { path: 'orders', name: 'AdminOrders', component: () => import('@/views/admin/OrderManagement.vue'), meta: { requiresAuth: true } },

      // 预设管理
      { path: 'styles', name: 'AdminStyles', component: () => import('@/views/admin/StylesView.vue'), meta: { requiresAuth: true } },
      { path: 'styles/create', redirect: '/admin/styles' },

      // 项目管理
      { path: 'studios', name: 'AdminStudios', component: () => import('@/views/studio/StudioList.vue'), meta: { requiresAuth: true } },
      { path: 'studio/create/step1', name: 'Window_B_Step1', component: () => import('@/views/admin/Window_B_Step1.vue'), meta: { requiresAuth: true } },
      { path: 'studio/create/step2', name: 'Window_B_Step2', component: () => import('@/views/admin/Window_B_Step2.vue'), meta: { requiresAuth: true } },
      { path: 'studio/create/step3', name: 'Window_B_Step3', component: () => import('@/views/admin/Window_B_Step3.vue'), meta: { requiresAuth: true } },
      { path: 'studio/edit/:id', name: 'EditStudio', component: () => import('@/views/admin/EditStudio.vue'), meta: { requiresAuth: true } },

      // 辅助功能
      { path: 'settings', name: 'AdminSettings', component: () => import('@/views/admin/SettingsView.vue'), meta: { requiresAuth: true } },
      { path: 'notifications', name: 'AdminNotifications', component: () => import('@/views/admin/NotificationsView.vue'), meta: { requiresAuth: true } },
      { path: 'logs', name: 'AdminLogs', component: () => import('@/views/admin/LogsView.vue'), meta: { requiresAuth: true } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ==================== 全局前置导航守卫 ====================
router.beforeEach((to, _from, next) => {
  const adminToken = getAdminToken()
  const clientToken = getClientToken()

  // 已登录 B 端用户访问登录页 → 直接跳后台首页
  if (adminToken && to.path === '/admin/login') {
    return next('/admin/orders')
  }

  // 需要鉴权的 B 端路由，无 Token → 拦截到登录页
  const requiresAdminAuth = to.matched.some(r => r.meta?.requiresAuth)
  if (requiresAdminAuth && !adminToken) {
    return next('/admin/login')
  }

  // ★ 客户端路由守护：需要登录的页面，无 Token → 拦截到客户端登录页
  const requiresClientAuth = to.matched.some(r => r.meta?.requiresClientAuth)
  if (requiresClientAuth && !clientToken) {
    const mId = to.query.mId || _from.query.mId || ''
    const redirect = to.fullPath
    const query = new URLSearchParams()
    if (mId) query.set('mId', mId)
    query.set('redirect', redirect)
    return next('/login?' + query.toString())
  }

  // 已登录客户端用户访问登录页且有 redirect → 直接跳回
  if (clientToken && to.path === '/login' && to.query.redirect) {
    return next(to.query.redirect)
  }

  next()
})

export default router
