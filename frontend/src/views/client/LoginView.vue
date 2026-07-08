<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useClientAuthStore } from '@/stores/clientAuth'

const router = useRouter()
const route = useRoute()
const auth = useClientAuthStore()

const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const nickname = ref('')

const mId = ref(route.query.mId || '')
const redirect = ref(route.query.redirect || '')

onMounted(() => {
  if (auth.isLoggedIn) {
    doRedirect()
  }
})

function doRedirect() {
  let target = redirect.value || '/studio-filter'
  // 保护已有 mId 参数不被覆盖
  if (mId.value && !target.includes('mId=')) {
    target += (target.includes('?') ? '&' : '?') + 'mId=' + mId.value
  }
  router.replace(target)
}

async function handleOAuthLogin(provider) {
  loading.value = true
  errorMsg.value = ''
  successMsg.value = '正在获取授权...'

  // 模拟 OAuth code（生产环境由 SDK 提供）
  const code = provider + '_auth_' + Date.now().toString(36)
  const result = await auth.oauthLogin(provider, code, nickname.value || undefined)

  if (result.success) {
    successMsg.value = result.data.isNew ? '欢迎新用户，注册成功！' : '登录成功，正在跳转...'
    setTimeout(() => doRedirect(), 600)
  } else {
    errorMsg.value = result.message || '授权失败，请重试'
  }
  loading.value = false
}
</script>

<template>
  <div class="client-login-page">
    <div class="login-box fade-in-up">
      <h2>🐱 喵喵预约</h2>

      <div v-if="!mId" class="warning">未检测到商家信息，登录后将跳转至浏览页</div>

      <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
      <div v-if="successMsg" class="success">{{ successMsg }}</div>

      <el-input v-model="nickname" placeholder="你的昵称（选填）"
                style="margin-bottom:16px;" clearable :disabled="loading" />

      <!-- OAuth 登录按钮 -->
      <el-button
        type="success" style="width:100%;margin-bottom:12px;height:48px;font-size:15px;"
        @click="handleOAuthLogin('wechat')" :loading="loading"
      >
        🟢 微信授权登录
      </el-button>

      <el-button
        type="primary" style="width:100%;height:48px;font-size:15px;background:#12B7F5;border-color:#12B7F5;"
        @click="handleOAuthLogin('qq')" :loading="loading"
      >
        🔵 QQ 授权登录
      </el-button>

      <p style="margin-top:20px;font-size:12px;color:#8e8e93;text-align:center;">
        登录即表示同意《服务协议》<br />授权后将自动注册或绑定已有账号
      </p>
    </div>
  </div>
</template>

<style scoped>
.client-login-page {
  min-height: 100vh; min-height: 100dvh;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(244,164,96,.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(18,183,245,.06) 0%, transparent 50%),
    #F9F8F6;
  position: relative; overflow: hidden;
}
.warning { color: #B8860B; font-size: 13px; text-align: center; padding: 8px; background: #FFF8E1; border-radius: 8px; margin-bottom: 8px; }
.client-login-page::before {
  content: '';
  position: absolute; top: -40%; left: -20%;
  width: 140%; height: 140%;
  background:
    radial-gradient(circle at 30% 40%, rgba(244,164,96,.04) 0%, transparent 40%),
    radial-gradient(circle at 70% 60%, rgba(160,200,180,.04) 0%, transparent 40%);
  pointer-events: none; z-index: 0;
}
</style>
