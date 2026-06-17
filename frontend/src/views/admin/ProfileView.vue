<template>
  <div class="profile-view fade-in-up">
    <div class="section-box">
      <h3><i class="fa-solid fa-user-gear"></i> 个人中心</h3>
      <p>商家ID：<strong>{{ auth.mId }}</strong></p>
      <p>店铺名称：<strong>{{ auth.shopName }}</strong></p>
      <el-button type="danger" @click="handleLogout">退出登录</el-button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

function handleLogout() {
  auth.logout()
  router.replace({ name: 'AdminLogin' })
}
</script>

<style scoped>
.section-box {
  max-width: 600px; background: var(--bg-card, #fff); border-radius: 16px; padding: 20px;
  border: 1px solid var(--border-color, #F0EDE8); box-shadow: 0 2px 8px rgba(0,0,0,.03);
}
.section-box h3 { margin: 0 0 16px; font-size: 16px; display: flex; align-items: center; gap: 8px; }
.section-box p { margin-bottom: 12px; font-size: 14px; }
</style>
