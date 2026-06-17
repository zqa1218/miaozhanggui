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
const regForm = ref({
  username: '', password: '', shopName: '',
  shopMode: 'studio',
  invitationCode: '',
})
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
      storage.set('mzg_admin_role', data.shopMode || 'studio')
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

      <!-- ★ 角色选择卡片 -->
      <div class="role-select-section">
        <div class="role-select-label">选择注册身份</div>
        <div class="role-cards">
          <div
            v-for="r in ROLE_OPTIONS"
            :key="r.key"
            class="role-card"
            :class="{ active: regForm.shopMode === r.key }"
            @click="regForm.shopMode = r.key"
          >
            <span class="role-card-icon">{{ r.icon }}</span>
            <span class="role-card-label">{{ r.label }}</span>
            <span class="role-card-desc">{{ r.desc }}</span>
          </div>
        </div>
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
/* ── 角色选择卡片 ── */
.role-select-section {
  padding: 12px 0;
  margin-bottom: 12px;
  border-top: 1px solid var(--border-color, #F0EDE8);
}
.role-select-label {
  font-size: 13px; font-weight: 700;
  color: var(--text-primary, #4A4A4A);
  margin-bottom: 10px;
}
.role-cards {
  display: flex; gap: 8px;
}
.role-card {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 14px 8px; border-radius: 14px;
  border: 2px solid var(--border-color, #E8E5DF);
  background: var(--bg-card, #fff);
  cursor: pointer; transition: all 0.25s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  user-select: none; text-align: center;
}
.role-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,.03));
}
.role-card.active {
  border-color: var(--color-primary, #F4A460);
  background: var(--color-peach-light, #FEF7EF);
  box-shadow: 0 0 0 3px rgba(244,164,96,.08);
}
.role-card-icon { font-size: 28px; line-height: 1; }
.role-card-label { font-size: 14px; font-weight: 700; color: var(--text-primary, #4A4A4A); }
.role-card-desc {
  font-size: 10px; color: var(--text-secondary, #8E8E8E);
  line-height: 1.3; max-width: 120px;
}
@media (max-width: 767px) {
  .role-cards { flex-direction: column; }
  .role-card { flex-direction: row; justify-content: center; gap: 10px; padding: 12px 16px; }
  .role-card-desc { display: none; }
}
</style>
