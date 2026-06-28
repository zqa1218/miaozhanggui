<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storage } from '@/utils/storage'
import { ElMessage } from 'element-plus'
import RefreshButton from '@/components/shared/RefreshButton.vue'

const router = useRouter()
const route = useRoute()

const props = defineProps({
  shopName: { type: String, default: '' },
  mId: { type: String, default: '' },
  merchantRole: { type: String, default: 'photographer' },
  isAdminUser: { type: Boolean, default: false },
})

const roleLabel = computed(() => {
  const map = { photographer: '📷 摄影', makeup_artist: '💄 妆娘', studio_owner: '🏠 棚主' }
  return map[props.merchantRole] || '摄影'
})

const customerOrderLink = computed(() => {
  const origin = window.location.origin
  const mId = props.mId
  // 不同角色对应不同的客户端链接前缀
  const prefixMap = {
    photographer: '',
    makeup_artist: '/m',
    studio_owner: '/s',
  }
  const prefix = prefixMap[props.merchantRole] || ''
  return `${origin}${prefix}/studios?mId=${mId}`
})

function logout() {
  storage.remove('mzg_admin_token')
  storage.remove('mzg_admin_mid')
  storage.remove('mzg_admin_shopname')
  storage.remove('mzg_admin_merchant_role')
  router.push('/admin/login')
}

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
</script>

<template>
  <!-- 顶栏 -->
  <div class="header-admin">
    <div class="header-left">
      <slot name="hamburger" />
      <div class="header-info">
        <div class="header-badge">{{ roleLabel }}</div>
        <div class="header-title">{{ shopName || '喵掌柜后台' }}</div>
        <div class="header-mid">商家ID: <strong>{{ mId }}</strong></div>
      </div>
    </div>
    <div class="header-actions">
      <RefreshButton
        :on-refresh="async () => { }"
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
    <el-button type="primary" size="small" round @click="handleCopyLink">
      {{ copyBtnText }}
    </el-button>
  </div>
</template>

<style scoped>
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
.header-badge {
  display: inline-block;
  padding: 2px 12px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 12px;
  margin-bottom: 4px;
  width: fit-content;
  background: linear-gradient(135deg, #FEF7EF, #FFF3E0);
  color: #D4893E;
  border: 1px solid rgba(244,164,96,.25);
  letter-spacing: 0.5px;
}
.header-mid { font-size: 12px; color: var(--sub); margin-top: 2px; }
.header-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.btn-logout { padding: 8px 18px; font-size: 13px; white-space: nowrap; }
.btn-admin-dash {
  padding: 8px 18px; font-size: 13px; white-space: nowrap;
  border: 1px solid #E8E5DF; border-radius: 20px; background: #fff;
  cursor: pointer; color: #D4893E; font-weight: 600;
}
.btn-admin-dash:hover { background: #FEF7EF; border-color: #F4A460; }

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
.link-label { font-size: 12px; color: #8E8E8E; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
.link-text {
  flex: 1; min-width: 140px;
  font-size: 12px; font-family: 'SF Mono', 'Cascadia Code', monospace;
  color: #F4A460; opacity: .70;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

@media (max-width: 767px) {
  .header-admin { padding: 12px 14px; border-radius: 16px; margin-bottom: 10px; }
  .header-title { font-size: 16px; }
  .header-mid { font-size: 11px; }
  .btn-logout { padding: 6px 14px; font-size: 12px; }
  .order-link-bar { padding: 10px 14px; gap: 8px; margin: 8px 0 4px; }
  .link-text { font-size: 11px; }
}
</style>
