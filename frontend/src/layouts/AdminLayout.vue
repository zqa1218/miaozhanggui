<script setup>
import { ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { storage } from '@/utils/storage'
import PhotographerDashboard from './PhotographerDashboard.vue'
import MakeupArtistDashboard from './MakeupArtistDashboard.vue'
import StudioOwnerDashboard from './StudioOwnerDashboard.vue'

// ════════════════════════════════════════
//  AdminLayout — B端入口
//
//  根据 merchantRole 渲染对应的 Dashboard，
//  所有子页面路由（orders/studios/settings...）由各 Dashboard 内部的 RouterView 处理。
//
//  退出登录时 AdminHeader 清除 storage 并跳转 /admin/login，
//  watch 检测到路由变化后刷新 isLoggedIn → 切换到登录页。
// ════════════════════════════════════════

const route = useRoute()

const isLoggedIn = ref(!!storage.get('mzg_admin_token', ''))
const merchantRole = ref(storage.get('mzg_admin_merchant_role', 'photographer'))

// 路由变化时重新检查 storage，确保退出/登录后视图立即切换
watch(() => route.fullPath, () => {
  isLoggedIn.value = !!storage.get('mzg_admin_token', '')
  merchantRole.value = storage.get('mzg_admin_merchant_role', 'photographer')
})
</script>

<template>
  <div class="admin-layout">
    <!-- 未登录：渲染 RouterView（仅 /admin/login 命中） -->
    <template v-if="!isLoggedIn">
      <RouterView />
    </template>

    <!-- 已登录：根据角色渲染对应 Dashboard（三种均内嵌 RouterView 显示子页面） -->
    <template v-else-if="merchantRole === 'photographer'">
      <PhotographerDashboard />
    </template>
    <template v-else-if="merchantRole === 'makeup_artist'">
      <MakeupArtistDashboard />
    </template>
    <template v-else-if="merchantRole === 'studio_owner'">
      <StudioOwnerDashboard />
    </template>

    <!-- 兜底：已登录但 role 未知 -->
    <template v-else>
      <RouterView />
    </template>
  </div>
</template>

<style>
.admin-layout { min-height: 100vh; min-height: 100dvh; padding: 0 0 32px; }
</style>
