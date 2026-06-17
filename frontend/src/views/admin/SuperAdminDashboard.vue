<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storage } from '@/utils/storage'
import { ElMessage } from 'element-plus'

const router = useRouter()

// ── 鉴权 ──
const token = ref(storage.get('mzg_admin_token', ''))
const isAdmin = ref(false)

function checkAdmin() {
  if (!token.value) { router.push('/admin/login'); return false }
  try {
    const payload = JSON.parse(atob(token.value.split('.')[1]))
    if (!payload.isAdmin) { ElMessage.error('无管理员权限'); router.push('/admin/orders'); return false }
    isAdmin.value = true
    return true
  } catch { router.push('/admin/login'); return false }
}

// ── 菜单 ──
const activeMenu = ref('merchants')

// ── 商家列表 ──
const merchants = ref([])
const merchantsLoading = ref(false)
const totalMerchants = ref(0)
const merchantPage = ref(1)
const merchantPageSize = 20

async function loadMerchants() {
  merchantsLoading.value = true
  try {
    const params = new URLSearchParams({ page: merchantPage.value, pageSize: merchantPageSize })
    const res = await fetch(`/api/admin/merchants?${params}`, {
      headers: { Authorization: `Bearer ${token.value}` },
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      merchants.value = res.data.list || []
      totalMerchants.value = res.data.total || 0
    }
  } catch { ElMessage.error('加载商家列表失败') }
  merchantsLoading.value = false
}

// ── 邀请码 ──
const generateCount = ref(5)
const generating = ref(false)
const newCodes = ref([])
const allCodes = ref([])
const codesLoading = ref(false)
const codePage = ref(1)
const codePageSize = 50
const codeFilterUsed = ref('')
const totalCodes = ref(0)

async function generateCodes() {
  generating.value = true
  try {
    const res = await fetch('/api/admin/invitation-codes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.value}` },
      body: JSON.stringify({ count: parseInt(generateCount.value) || 1 }),
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      newCodes.value = res.data.codes || []
      ElMessage.success(`成功生成 ${res.data.count} 个邀请码`)
      loadAllCodes()
    } else {
      ElMessage.error(res.message || '生成失败')
    }
  } catch { ElMessage.error('网络错误') }
  generating.value = false
}

async function loadAllCodes() {
  codesLoading.value = true
  try {
    const params = new URLSearchParams({ page: codePage.value, pageSize: codePageSize })
    if (codeFilterUsed.value) params.set('isUsed', codeFilterUsed.value)
    const res = await fetch(`/api/admin/invitation-codes?${params}`, {
      headers: { Authorization: `Bearer ${token.value}` },
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      allCodes.value = res.data.list || []
      totalCodes.value = res.data.total || 0
    }
  } catch { ElMessage.error('加载邀请码失败') }
  codesLoading.value = false
}

async function copyInviteLink(code) {
  const text = `【喵掌柜】您好，这是您的专属入驻邀请码：${code} 。请访问以下链接完成注册：${window.location.origin}/register?code=${code} （注：该邀请码仅可使用一次）`
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('邀请文案已复制到剪贴板')
    return
  } catch { /* HTTP 环境下 Clipboard API 不可用，走 textarea 兜底 */ }

  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'; ta.style.left = '-9999px'; ta.style.top = '-9999px'
  document.body.appendChild(ta)
  ta.focus(); ta.select()
  try {
    document.execCommand('copy')
    ElMessage.success('邀请文案已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
  document.body.removeChild(ta)
}

function logout() {
  storage.remove('mzg_admin_token')
  storage.remove('mzg_admin_mid')
  storage.remove('mzg_admin_shopname')
  router.push('/admin/login')
}

onMounted(() => {
  if (!checkAdmin()) return
  loadMerchants()
  loadAllCodes()
})
</script>

<template>
  <div class="super-admin" v-if="isAdmin">
    <!-- 顶栏 -->
    <div class="sa-header">
      <span class="sa-title">喵掌柜 · 超级管理员</span>
      <button class="btn-logout" @click="logout">退出</button>
    </div>

    <div class="sa-body">
      <!-- 左侧菜单 -->
      <div class="sa-sidebar">
        <div :class="['sa-menu-item', { active: activeMenu === 'merchants' }]" @click="activeMenu = 'merchants'">
          📊 商家管理
        </div>
        <div :class="['sa-menu-item', { active: activeMenu === 'codes' }]" @click="activeMenu = 'codes'">
          🎫 邀请码生成
        </div>
      </div>

      <!-- 右侧内容区 -->
      <div class="sa-content fade-in-up">
        <!-- ====== 商家管理 ====== -->
        <template v-if="activeMenu === 'merchants'">
          <!-- KPI 卡片 -->
          <div class="kpi-card">
            <div class="kpi-value">{{ totalMerchants }}</div>
            <div class="kpi-label">当前已入驻商家总数</div>
          </div>

          <div class="section-title" style="margin-top:24px;">已注册商家列表</div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>商家ID</th>
                  <th>用户名</th>
                  <th>店铺名称</th>
                  <th>邀请码</th>
                  <th>注册时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in merchants" :key="m.m_id">
                  <td><code>{{ m.m_id }}</code></td>
                  <td>{{ m.username }}</td>
                  <td>{{ m.shop_name }}</td>
                  <td>
                    <span v-if="m.invitation_code" class="code-tag">{{ m.invitation_code }}</span>
                    <span v-else style="color:#ccc;">—</span>
                  </td>
                  <td>{{ m.created_at ? m.created_at.slice(0, 19) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ====== 邀请码生成 ====== -->
        <template v-if="activeMenu === 'codes'">
          <div class="generate-panel">
            <div class="section-title">生成邀请码</div>
            <div style="display:flex;align-items:center;gap:12px;margin-top:16px;">
              <span style="font-size:14px;color:var(--sub);white-space:nowrap;">生成数量</span>
              <el-input-number v-model="generateCount" :min="1" :max="100" size="small" style="width:120px;" />
              <el-button type="primary" @click="generateCodes" :loading="generating">生成</el-button>
            </div>
          </div>

          <!-- 新生成的码 -->
          <div v-if="newCodes.length > 0" class="new-codes-section" style="margin-top:20px;">
            <div class="section-title">最新生成的邀请码</div>
            <div class="code-card-grid">
              <div v-for="code in newCodes" :key="code" class="code-card">
                <div class="code-text">{{ code }}</div>
                <el-button size="small" type="primary" @click="copyInviteLink(code)">📋 复制邀请链接</el-button>
              </div>
            </div>
          </div>

          <!-- 全部邀请码列表 -->
          <div class="section-title" style="margin-top:20px;">全部邀请码（{{ totalCodes }}）</div>
          <div style="display:flex;gap:12px;margin:12px 0;">
            <el-radio-group v-model="codeFilterUsed" size="small" @change="loadAllCodes">
              <el-radio-button label="">全部</el-radio-button>
              <el-radio-button label="true">已使用</el-radio-button>
              <el-radio-button label="false">未使用</el-radio-button>
            </el-radio-group>
          </div>
          <div class="table-wrap" style="max-height:500px;overflow-y:auto;">
            <table class="data-table">
              <thead><tr><th>邀请码</th><th>状态</th><th>使用者</th><th>使用时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="c in allCodes" :key="c.code" :class="{ 'row-used': c.is_used }">
                  <td><code>{{ c.code }}</code></td>
                  <td>
                    <span v-if="c.is_used" class="badge-used">已失效</span>
                    <span v-else class="badge-valid">有效</span>
                  </td>
                  <td>{{ c.used_by_m_id || '—' }}</td>
                  <td>{{ c.used_at ? c.used_at.slice(0, 19) : '—' }}</td>
                  <td>
                    <el-button v-if="!c.is_used" size="small" @click="copyInviteLink(c.code)">📋 复制</el-button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.super-admin { min-height:100vh;min-height:100dvh; background:var(--bg-page, #F9F8F6); }
.sa-header {
  display:flex; justify-content:space-between; align-items:center;
  padding:16px 32px; background:var(--bg-card, #fff); border-bottom:1px solid var(--border-color, #F0EDE8);
  box-shadow:0 2px 12px rgba(0,0,0,.04);
}
.sa-title { font-size:18px; font-weight:700; color:var(--text-primary, #4A4A4A); }
.btn-logout { padding:8px 20px; border:1px solid var(--border-color, #E8E5DF); border-radius:20px; background:var(--bg-card, #fff); cursor:pointer; font-size:13px; color:var(--text-secondary, #8E8E8E); }
.btn-logout:hover { background:var(--color-peach-light, #FEF7EF); border-color:#F4A460; color:#D4893E; }

.sa-body { display:flex; min-height:calc(100vh - 65px); }
.sa-sidebar {
  width:220px; background:var(--bg-card, #fff); border-right:1px solid var(--border-color, #F0EDE8);
  padding:20px 0; flex-shrink:0;
}
.sa-menu-item {
  padding:14px 24px; font-size:14px; font-weight:600; color:var(--text-secondary, #8E8E8E);
  cursor:pointer; transition:all .15s;
}
.sa-menu-item:hover { color:#D4893E; background:var(--color-peach-light, #FEF7EF); }
.sa-menu-item.active { color:#D4893E; background:var(--color-peach-light, #FEF7EF); border-right:3px solid #F4A460; }

.sa-content { flex:1; padding:28px 36px; overflow-y:auto; }

/* KPI 卡片 */
.kpi-card {
  background:linear-gradient(135deg, #FEF7EF, #FFF);
  border-radius:24px; padding:32px 40px; box-shadow:0 4px 20px rgba(0,0,0,.04);
  text-align:center; border:1px solid #F0E8D8;
}
.kpi-value { font-size:56px; font-weight:800; color:#D4893E; line-height:1.2; }
.kpi-label { font-size:15px; color:var(--text-secondary, #8E8E8E); margin-top:8px; font-weight:600; }

.section-title { font-size:16px; font-weight:700; color:var(--text-primary, #4A4A4A); margin-bottom:4px; }

/* 表格 */
.table-wrap { overflow-x:auto; background:var(--bg-card, #fff); border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,.03); }
.data-table { width:100%; border-collapse:collapse; font-size:13px; }
.data-table th { background:var(--bg-table-stripe, #FAFAFA); padding:12px 16px; text-align:left; font-weight:600; color:var(--text-secondary, #8E8E8E); border-bottom:1px solid var(--border-color, #F0EDE8); }
.data-table td { padding:12px 16px; border-bottom:1px solid var(--border-color, #F8F6F3); color:var(--text-primary, #4A4A4A); }
.data-table code { font-size:11px; background:#F8F6F3; padding:2px 6px; border-radius:4px; }
.code-tag { font-size:11px; background:var(--color-success-bg, #EDF6F0); color:#5A8A6A; padding:2px 8px; border-radius:4px; font-family:monospace; }

/* 邀请码卡片 */
.code-card-grid { display:flex; flex-wrap:wrap; gap:12px; margin-top:12px; }
.code-card {
  background:var(--bg-card, #fff); border:1px solid var(--border-color, #F0EDE8); border-radius:16px;
  padding:16px 20px; display:flex; align-items:center; gap:16px;
  box-shadow:0 2px 8px rgba(0,0,0,.03);
}
.code-text { font-size:20px; font-weight:800; color:var(--text-primary, #4A4A4A); font-family:'SF Mono','Cascadia Code',monospace; letter-spacing:2px; }

/* 状态徽章 */
.badge-used { font-size:11px; padding:3px 10px; border-radius:10px; background:rgba(180,180,190,.12); color:#888; font-weight:600; }
.badge-valid { font-size:11px; padding:3px 10px; border-radius:10px; background:rgba(168,216,185,.20); color:#5A8A6A; font-weight:600; }
.row-used { opacity:.60; }

/* 响应式 */
@media (max-width:767px) {
  .sa-sidebar { display:none; }
  .sa-content { padding:16px; }
  .kpi-value { font-size:36px; }
  .kpi-card { padding:20px 24px; }
}
</style>
