<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storage } from '@/utils/storage'

const router = useRouter()
const loginTab = ref('login')
const loginLoading = ref(false)
const regLoading = ref(false)

const loginForm = ref({ username: '', password: '' })
const regForm = ref({ username: '', password: '', shopName: '', isStudioOwner: false })
const errorMsg = ref('')
const successMsg = ref('')

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
    const res = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regForm.value)
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      const data = res.data || res
      loginForm.value.username = regForm.value.username
      loginForm.value.password = regForm.value.password
      loginTab.value = 'login'
      successMsg.value = '注册成功！商家ID: ' + (data.mId || '') + '，请登录'
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
      <el-input v-model="regForm.shopName" placeholder="店铺名称"
                style="margin-bottom:12px;" clearable />
      <el-input v-model="regForm.username" placeholder="账号(3-32字符)"
                style="margin-bottom:12px;" clearable />
      <el-input v-model="regForm.password" type="password" placeholder="密码(6-64字符)" show-password
                style="margin-bottom:12px;" />
      <div class="studio-owner-toggle">
        <span>棚主注册</span>
        <el-switch v-model="regForm.isStudioOwner" />
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
.studio-owner-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  margin-bottom: 12px;
  font-size: 14px;
  color: #4A4A4A;
  font-weight: 600;
  border-top: 1px solid #F0EDE8;
}
</style>
