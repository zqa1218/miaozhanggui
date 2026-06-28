<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storage } from '@/utils/storage'

const router = useRouter()
const route = useRoute()

const ROLE_OPTIONS = [
  { key: 'studio', label: '棚主', desc: '管理摄影棚、项目与订单', icon: '📸' },
  { key: 'photographer', label: '摄影', desc: '管理拍摄档期与作品', icon: '📷' },
  { key: 'makeup_artist', label: '妆娘', desc: '管理妆造档期与风格', icon: '💄' },
]

// ★ 带邀请码访问 → 自动切换到注册面板
const loginTab = ref(route.query.code ? 'register' : 'login')
const loginLoading = ref(false)
const regLoading = ref(false)

const loginForm = ref({ username: '', password: '' })
const regForm = ref({ username: '', password: '', shopName: '', merchantRole: 'photographer', invitationCode: '' })
const inviteCodeFromUrl = ref(false)

// ★ 自动回填邀请码
function initInviteCode() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code') || params.get('invitationCode')
  if (code) {
    regForm.value.invitationCode = code
    inviteCodeFromUrl.value = true
  }
}
initInviteCode()
const errorMsg = ref('')
const successMsg = ref('')

const currentRole = computed(() => ROLE_OPTIONS.find(r => r.key === regForm.value.shopMode))

async function doLogin() {
  loginLoading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm.value)
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      const data = res.data || res
      storage.set('mzg_admin_token', data.token)
      storage.set('mzg_admin_mid', data.mId)
      storage.set('mzg_admin_shopname', data.shopName || '')
      storage.set('mzg_admin_merchant_role', data.merchantRole || 'photographer')
      location.reload()
    } else {
      errorMsg.value = res.message || '登录失败'
    }
  } catch { errorMsg.value = '网络错误' }
  loginLoading.value = false
}

async function doRegister() {
  regLoading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const payload = {
      username: regForm.value.username,
      password: regForm.value.password,
      shopName: regForm.value.shopName,
      shopMode: regForm.value.shopMode,
      invitationCode: regForm.value.invitationCode,
    }
    const res = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      const data = res.data || res
      loginForm.value.username = regForm.value.username
      loginForm.value.password = regForm.value.password
      loginTab.value = 'login'
      const roleName = ROLE_OPTIONS.find(r => r.key === regForm.value.shopMode)?.label || '商家'
      successMsg.value = `${roleName}号注册成功！ID: ` + (data.mId || '') + '，请登录'
    } else {
      errorMsg.value = res.message || '注册失败'
    }
  } catch { errorMsg.value = '网络错误' }
  regLoading.value = false
}
</script>

<template>
  <div class="login-box fade-in-up">
    <h2>&#x1F431; 喵掌柜后台</h2>

    <el-tabs v-model="loginTab" stretch>
      <el-tab-pane label="登录" name="login"></el-tab-pane>
      <el-tab-pane label="注册" name="register"></el-tab-pane>
    </el-tabs>

    <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="success">{{ successMsg }}</div>

    <template v-if="loginTab === 'login'">
      <el-input v-model="loginForm.username" placeholder="账号"
                style="margin-bottom:12px;" clearable />
      <el-input v-model="loginForm.password" type="password" placeholder="密码" show-password
                style="margin-bottom:12px;" @keyup.enter="doLogin" />
      <el-button type="primary" style="width:100%;" @click="doLogin" :loading="loginLoading">
        登录
      </el-button>
    </template>

    <template v-else>
      <el-input v-model="regForm.shopName" placeholder="店铺/工作室名称"
                style="margin-bottom:12px;" clearable />
      <el-input v-model="regForm.username" placeholder="账号(3-32字符)"
                style="margin-bottom:12px;" clearable />
      <el-input v-model="regForm.password" type="password" placeholder="密码(6-64字符)" show-password
                style="margin-bottom:12px;" />
      <el-input v-model="regForm.invitationCode" placeholder="邀请码（必填）"
                style="margin-bottom:12px;" :disabled="inviteCodeFromUrl" clearable />
      <div class="role-selector">
        <span class="role-label">选择身份</span>
        <el-radio-group v-model="regForm.merchantRole" class="role-radio-group">
          <el-radio-button value="photographer">📷 摄影</el-radio-button>
          <el-radio-button value="makeup_artist">💄 妆娘</el-radio-button>
          <el-radio-button value="studio_owner">🏠 棚主</el-radio-button>
        </el-radio-group>
      </div>

      <el-button type="success" style="width:100%;" @click="doRegister" :loading="regLoading">
        注册入驻
      </el-button>
    </template>

    <p style="margin-top:16px;font-size:12px;color:#8e8e93;text-align:center;">
      注册后将获得商家ID，请妥善保存
    </p>
  </div>
</template>

<style scoped>
.role-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0;
  margin-bottom: 12px;
  font-size: 14px;
  color: #4A4A4A;
  font-weight: 600;
  border-top: 1px solid #F0EDE8;
}
.role-label {
  font-size: 13px;
  color: #8E8E8E;
  font-weight: 500;
}
.role-radio-group {
  display: flex;
  width: 100%;
}
.role-radio-group :deep(.el-radio-button__inner) {
  padding: 10px 16px;
  font-size: 13px;
}
.role-radio-group :deep(.el-radio-button) {
  flex: 1;
}
.role-radio-group :deep(.is-active .el-radio-button__inner) {
  background: #FFF7EF;
  border-color: #F4A460;
  color: #D4893E;
}
</style>
