<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWizardCStore } from '@/stores/wizardC'
import { storage, getQueryParam } from '@/utils/storage'
import DeclarationDialog from '@/components/shared/DeclarationDialog.vue'

const route = useRoute()
const router = useRouter()
const wizardC = useWizardCStore()

const studioId = computed(() => {
  const id = parseInt(route.params.studioId)
  return isNaN(id) ? null : id
})
const mId = computed(() => getQueryParam('mId') || route.query.mId || storage.get('mzg_client_mid', ''))
const DEVICE_ID = computed(() => storage.get('mzg_device_id', '') || 'dev_' + Date.now().toString(36))

// 保护：无数据时退回 step1
onMounted(() => {
  if (!wizardC.bookingDate || !wizardC.startTime) {
    router.replace(`/booking/${studioId.value}?mId=${mId.value}`)
  }
})

// ── 表单 ──
const roleName = ref(wizardC.roleName || '')
const CONTACT_TYPES = [
  { key: 'qq',     label: 'QQ',       icon: 'fa-brands fa-qq',         placeholder: '请输入QQ号' },
  { key: 'wechat', label: '微信',     icon: 'fa-brands fa-weixin',     placeholder: '请输入微信号' },
  { key: 'phone',  label: '手机号',   icon: 'fa-solid fa-mobile-alt',  placeholder: '请输入手机号' },
  { key: 'other',  label: '其他',     icon: 'fa-solid fa-globe',       placeholder: '请备注网站/平台名称' },
]
const contactType = ref(wizardC.contactType || '')
const contactValue = ref(wizardC.contactValue || '')
const contactNote = ref(wizardC.contactNote || '')
const submitting = ref(false)
const errorMsg = ref('')
const orderResult = ref(wizardC.orderResult)

// ── 图片上传 ──
const characterImage = ref(null)           // 角色人设图 URL
const characterImageUploading = ref(false)
const referenceImages = ref([])            // 参考动作图 URL 数组
const referenceImagesUploading = ref(false)

function makeFormData(file) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('folder', 'order_refs')
  return fd
}

async function uploadFile(file) {
  const fd = makeFormData(file)
  const res = await fetch('/api/upload/image', {
    method: 'POST',
    headers: { 'x-device-id': DEVICE_ID.value },
    body: fd,
  }).then(r => r.json())
  if (res.success && res.data?.url) return res.data.url
  throw new Error(res.message || '上传失败')
}

function handleCharacterFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { errorMsg.value = '请选择图片文件'; return }
  characterImageUploading.value = true
  uploadFile(file).then(url => { characterImage.value = url }).catch(err => { errorMsg.value = err.message })
    .finally(() => { characterImageUploading.value = false; e.target.value = '' })
}

async function handleReferenceFiles(e) {
  const files = Array.from(e.target.files || [])
  const remaining = 6 - referenceImages.value.length
  if (files.length > remaining) { errorMsg.value = `最多还能添加 ${remaining} 张`; e.target.value = ''; return }
  referenceImagesUploading.value = true
  const urls = []
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    try { urls.push(await uploadFile(file)) } catch (err) { errorMsg.value = err.message; break }
  }
  referenceImages.value = [...referenceImages.value, ...urls]
  referenceImagesUploading.value = false
  e.target.value = ''
}

function removeCharacterImage() { characterImage.value = null }
function removeReferenceImage(index) { referenceImages.value.splice(index, 1) }

// ── 收款码 ──
const merchantSettings = ref({})
const showPaymentModal = ref(false)

// ── 声明弹窗 ──
const showDeclaration = ref(false)
const declarationContent = ref('')

onMounted(async () => {
  if (mId.value) {
    try {
      const res = await fetch(`/api/settings?mId=${mId.value}`).then(r => r.json())
      if (res.success || res.code === 0) merchantSettings.value = res.data || {}
    } catch {}
  }
})

// ── 摘要 ──
const depositAmount = computed(() =>
  Math.round(wizardC.computedPrice * (wizardC.depositRatio || 30) / 100 * 100) / 100
)

// ── 支付流程 ──
function openPaymentModal() {
  if (!roleName.value.trim()) { errorMsg.value = '请输入要出的角色名称'; return }
  if (!contactType.value) { errorMsg.value = '请选择联系方式类型'; return }
  if (!contactValue.value.trim()) { errorMsg.value = '请填写联系方式'; return }
  errorMsg.value = ''
  wizardC.roleName = roleName.value.trim()
  wizardC.contactType = contactType.value
  wizardC.contactValue = contactValue.value.trim()
  wizardC.contactNote = contactNote.value.trim()

  // 检查弹窗声明
  if (merchantSettings.value.declarationEnabled && merchantSettings.value.declarationContent) {
    declarationContent.value = merchantSettings.value.declarationContent
    showDeclaration.value = true
    return
  }
  showPaymentModal.value = true
}

function onDeclarationClose() {
  showDeclaration.value = false
  showPaymentModal.value = true
}

async function confirmPaymentAndSubmit() {
  showPaymentModal.value = false
  submitting.value = true
  errorMsg.value = ''

  try {
    // 1. 创建订单 (V2 高精度)
    const payload = {
      mId: mId.value,
      studioId: studioId.value,
      styleId: wizardC.selectedStyleId || null,
      packageId: wizardC.selectedPackageId || null,
      fixedDuration: wizardC.packageFixedDuration || 0,
      optType: wizardC.pricingType || 'single',
      photoCount: wizardC.quantity || 1,
      modelExperience: wizardC.modelExperience || 'veteran',
      roleName: wizardC.roleName,
      contactType: wizardC.contactType,
      contactValue: wizardC.contactValue,
      contactNote: wizardC.contactNote || '',
      bookingStartDate: wizardC.bookingDate,
      bookingStartTime: wizardC.startTime,
      totalPrice: wizardC.computedPrice,
      selectedAddonIds: wizardC.selectedAddonIds || [],
      addonTotal: wizardC.addonTotal || 0,
      extraItems: (wizardC.selectedExtraItems || []).map(item => ({
        name: item.name,
        price: Number(item.price || 0),
        unit: item.unit || 'per_time',
        unitLabel: item.unitLabel || '',
        amount: Number(item.amount || 0),
      })),
      depositAmount: depositAmount.value,
      depositRatio: wizardC.depositRatio || 30,
      userDeviceId: DEVICE_ID.value,
      characterImage: characterImage.value,
      referenceImages: referenceImages.value.length > 0 ? referenceImages.value : null,
    }

    const createRes = await fetch('/api/create-order-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': DEVICE_ID.value },
      body: JSON.stringify(payload),
    }).then(r => r.json())

    if (!createRes.success && createRes.code !== 0) {
      errorMsg.value = createRes.message || '订单创建失败'
      submitting.value = false
      return
    }

    const orderNo = (createRes.data && createRes.data.orderNo) || ''

    // 2. 支付定金 → 写入 pre_lock slot (第一重锁)
    const payRes = await fetch('/api/pay-deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': DEVICE_ID.value },
      body: JSON.stringify({ orderNo, mId: mId.value }),
    }).then(r => r.json())

    if (payRes.success || payRes.code === 0) {
      wizardC.setLockStatus('pre_lock')
      orderResult.value = { ...createRes.data, orderNo, status: '定金待确认' }
      wizardC.setOrderResult(orderResult.value)
    } else {
      errorMsg.value = payRes.message || '支付确认失败，订单已创建但定金未锁定'
      orderResult.value = { orderNo, status: '待支付' }
      wizardC.setOrderResult(orderResult.value)
    }
  } catch (e) {
    errorMsg.value = '网络错误，请重试'
  } finally {
    submitting.value = false
  }
}

function goBack() { router.push(`/booking/${studioId.value}?mId=${mId.value}`) }
function goHome() { wizardC.resetAll(); router.push('/studio-filter') }
</script>

<template>
  <div class="c-step2 fade-in-up" style="max-width:520px;margin:0 auto;padding:0 0 30px;">
    <h1 style="font-size:18px;padding:12px 14px;color:var(--text-primary,#333);">确认信息与支付定金</h1>

    <!-- ★ 支付成功 — 等待商家核账 -->
    <div v-if="orderResult" class="success-panel">
      <h2>定金已提交，等待商家核账中...</h2>
      <div class="order-no-box">
        <span class="order-no-label">订单号</span>
        <strong>{{ orderResult.orderNo }}</strong>
      </div>
      <div class="lock-badges">
        <span v-if="orderResult.status === '定金待确认'" class="badge badge-warn">待商家核账</span>
        <span v-else class="badge badge-blue">{{ orderResult.status }}</span>
        <span v-if="wizardC.lockStatus==='pre_lock'" class="badge badge-lock">时段已预锁</span>
      </div>
      <div class="time-confirm">
        <strong>{{ wizardC.startTime }} — {{ wizardC.computedEndTime }}</strong>
        <div class="time-confirm-sub">总耗时: {{ wizardC.computedTotalMin }} 分钟</div>
      </div>

      <!-- ★ 收款码展示（预定成功后显示） -->
      <div v-if="merchantSettings.paymentQrCode || merchantSettings.alipayQrUrl || merchantSettings.wechatQrUrl" class="qr-section">
        <p class="qr-section-title">请扫码完成支付</p>
        <img
          v-if="merchantSettings.paymentQrCode"
          :src="merchantSettings.paymentQrCode"
          class="qr-preview"
          alt="收款码"
        />
        <div v-else class="qr-row-inline">
          <div v-if="merchantSettings.alipayQrUrl" class="qr-item-inline">
            <img :src="merchantSettings.alipayQrUrl" class="qr-preview-sm" alt="支付宝" />
            <span class="qr-tag alipay">支付宝</span>
          </div>
          <div v-if="merchantSettings.wechatQrUrl" class="qr-item-inline">
            <img :src="merchantSettings.wechatQrUrl" class="qr-preview-sm" alt="微信" />
            <span class="qr-tag wechat">微信</span>
          </div>
        </div>
        <p class="qr-save-hint">长按或保存图片 → 打开支付 App 扫码付款</p>
      </div>

      <p class="lock-notice">时段已预锁 · 摄影师核对流水后将正式确认</p>
      <button class="btn-primary" @click="goHome" style="margin-top:12px;">返回首页</button>
    </div>

    <template v-else>
      <!-- 订单摘要 -->
      <div class="section">
        <div class="section-title">订单摘要</div>
        <div class="summary-grid">
          <span class="k">日期</span><strong>{{ wizardC.bookingDate }}</strong>
          <span class="k">类型</span><strong>{{ wizardC.pricingType === 'single' ? '单张' : '套餐' }} × {{ wizardC.quantity }}</strong>
          <template v-if="wizardC.selectedExtraItems && wizardC.selectedExtraItems.length > 0">
            <span class="k">附加</span>
            <strong>
              <span v-for="(item, i) in wizardC.selectedExtraItems" :key="i">{{ item.name }}{{ i < wizardC.selectedExtraItems.length - 1 ? '、' : '' }}</span>
              · +¥{{ wizardC.addonTotal }}
            </strong>
          </template>
          <span v-if="wizardC.modelExperience && wizardC.modelExperience !== 'experienced'" class="k">经验</span>
          <strong v-if="wizardC.modelExperience && wizardC.modelExperience !== 'experienced'">{{ wizardC.modelExperience === 'newcomer' ? '新人' : wizardC.modelExperience }}</strong>
          <span class="k">角色</span><strong class="v-role">{{ roleName || '—' }}</strong>
          <span class="k">时间段</span><strong class="v-time">{{ wizardC.startTime }} — {{ wizardC.computedEndTime }}</strong>
          <span class="k">耗时</span><strong>{{ wizardC.computedTotalMin }} 分钟</strong>
          <span class="k">总金额</span><strong class="v-price">¥{{ wizardC.computedPrice }}</strong>
          <span class="k">定金</span><strong class="v-deposit">¥{{ depositAmount }}</strong>
        </div>
        <div v-if="!roleName.trim()" class="hint-danger">请在下方填写角色名称后继续</div>
      </div>

      <!-- ★ 角色与联系信息 -->
      <div class="section">
        <div class="section-title">角色与联系信息</div>
        <div class="input-row">
          <label>角色名称 <span style="color:var(--danger,#c98a8a);">*</span></label>
          <input v-model="roleName" placeholder="请填写您要出的角色名称（必填）" maxlength="256" class="input-field" style="width:100%;" />
        </div>
        <!-- 联系方式类型选择 -->
        <label style="display:block;font-size:12px;color:var(--sub,#999);margin-bottom:6px;">
          联系方式 <span style="color:var(--danger,#c98a8a);">*</span>
        </label>
        <div class="contact-type-row">
          <button
            v-for="ct in CONTACT_TYPES" :key="ct.key"
            :class="['contact-type-card', { active: contactType === ct.key }]"
            @click="contactType = ct.key"
          >
            <i :class="ct.icon" style="margin-right:4px;"></i>{{ ct.label }}
          </button>
        </div>
        <div class="input-row" style="margin-top:8px;">
          <input
            v-model="contactValue"
            :placeholder="(CONTACT_TYPES.find(c => c.key === contactType) || CONTACT_TYPES[0]).placeholder"
            class="input-field" style="width:100%;" maxlength="128"
          />
        </div>
        <div class="input-row">
          <label>备注</label>
          <textarea v-model="contactNote" placeholder="其他需求（选填）" rows="2" class="input-field" style="width:100%;"></textarea>
        </div>
      </div>

      <!-- ★ 角色人设图 -->
      <div class="section">
        <div class="section-title">🖼️ 角色人设图 <span class="opt-tag">可选，限1张</span></div>
        <div v-if="!characterImage" class="upload-card" @click="$refs.charInput.click()">
          <span v-if="characterImageUploading" class="upload-spin">⏳ 上传中...</span>
          <span v-else>点击上传角色人设图</span>
          <input ref="charInput" type="file" accept="image/*" hidden @change="handleCharacterFile" />
        </div>
        <div v-else class="preview-card">
          <img :src="characterImage" class="preview-thumb" />
          <button class="preview-remove" @click="removeCharacterImage">✕</button>
        </div>
      </div>

      <!-- ★ 参考动作图 -->
      <div class="section">
        <div class="section-title">📸 参考动作图 <span class="opt-tag">可选，最多6张</span></div>
        <div class="ref-grid">
          <div v-for="(url, i) in referenceImages" :key="url" class="ref-thumb-wrap">
            <img :src="url" class="ref-thumb" />
            <button class="preview-remove" @click="removeReferenceImage(i)">✕</button>
          </div>
          <div v-if="referenceImages.length < 6" class="upload-card ref-add" @click="$refs.refInput.click()">
            <span v-if="referenceImagesUploading">⏳</span>
            <span v-else>+</span>
            <input ref="refInput" type="file" accept="image/*" multiple hidden @change="handleReferenceFiles" />
          </div>
        </div>
        <div class="ref-count">{{ referenceImages.length }} / 6</div>
      </div>

      <div v-if="errorMsg" class="error-bar">❌ {{ errorMsg }}</div>

      <div style="padding:10px 14px 20px;display:flex;gap:10px;">
        <button class="btn-secondary" @click="goBack" style="flex:1;">← 上一步</button>
        <button class="btn-primary" @click="openPaymentModal" style="flex:2;" :disabled="!roleName.trim() || !contactType || !contactValue.trim()">
          支付定金 ¥{{ depositAmount }}
        </button>
      </div>
      <p class="lock-hint">支付 {{ wizardC.depositRatio || 30 }}% 定金后，时段将被预锁定</p>
    </template>

    <!-- ★ 收款码弹窗 (Teleport) -->
    <Teleport to="body">
      <div v-if="showPaymentModal" class="modal-overlay" @click.self="showPaymentModal = false">
        <div class="modal-box">
          <h3>支付定金</h3>
          <div class="modal-amount">¥{{ depositAmount }}</div>

          <!-- 优先显示统一 paymentQrCode，其次 alipay/wechat -->
          <div v-if="merchantSettings.paymentQrCode" class="qr-item">
            <img :src="merchantSettings.paymentQrCode" class="qr-img" />
            <p class="qr-label default">请扫码支付</p>
          </div>
          <div v-else-if="merchantSettings.alipayQrUrl || merchantSettings.wechatQrUrl || merchantSettings.qrCodeUrl" class="qr-row">
            <div v-if="merchantSettings.alipayQrUrl" class="qr-item">
              <img :src="merchantSettings.alipayQrUrl" class="qr-img" />
              <p class="qr-label alipay">支付宝</p>
            </div>
            <div v-if="merchantSettings.wechatQrUrl" class="qr-item">
              <img :src="merchantSettings.wechatQrUrl" class="qr-img" />
              <p class="qr-label wechat">微信</p>
            </div>
            <div v-if="merchantSettings.qrCodeUrl && !merchantSettings.alipayQrUrl && !merchantSettings.wechatQrUrl" class="qr-item">
              <img :src="merchantSettings.qrCodeUrl" class="qr-img" />
              <p class="qr-label default">收款码</p>
            </div>
          </div>
          <div v-else class="no-qr">
            <p>商家暂未上传收款码</p>
            <p style="font-size:11px;">请联系商家确认支付方式</p>
          </div>

          <p class="qr-hint">请扫码支付后点击下方按钮确认</p>

          <div class="modal-actions">
            <button class="btn-secondary" @click="showPaymentModal = false" style="flex:1;">稍后支付</button>
            <button class="btn-primary" @click="confirmPaymentAndSubmit" :disabled="submitting" style="flex:1;">
              {{ submitting ? '提交中...' : '我已支付' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 强制声明弹窗 -->
    <DeclarationDialog v-model="showDeclaration" :content="declarationContent" :studio-id="studioId" @close="onDeclarationClose" />
  </div>
</template>

<style scoped>
/* ─── 区块 ─── */
.section {
  background: rgba(255,255,255,0.72); backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin: 10px 14px; border-radius: 18px; padding: 14px;
  box-shadow: 0 4px 20px rgba(120,130,125,0.04);
  border: 1px solid rgba(180,185,182,0.18);
}
.section-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
.input-row { margin-bottom: 10px; }
.input-row label { display: block; font-size: 12px; color: var(--sub, #999); margin-bottom: 4px; }
.input-field {
  padding: 8px 12px; border: 1px solid #ddd; border-radius: 10px;
  font-size: 14px; outline: none; background: #fff;
}
.input-field:focus { border-color: var(--purple, #5a7a65); }

/* ─── 联系方式类型卡片 ─── */
.contact-type-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
}
.contact-type-card {
  padding: 10px 6px; border: 1.5px solid #E8E5DF; border-radius: 12px;
  background: #fff; font-size: 12px; font-weight: 600; cursor: pointer;
  text-align: center; color: #8E8E8E; transition: all .15s;
  font-family: inherit;
}
.contact-type-card:hover { border-color: #D4893E; color: #D4893E; }
.contact-type-card.active {
  border-color: #F4A460; background: linear-gradient(135deg, #FFF7ED, #FFF1E0);
  color: #D4893E; box-shadow: 0 2px 8px rgba(244,164,96,.12);
}

/* ─── 摘要 ─── */
.summary-grid {
  display: grid; grid-template-columns: 1fr 2fr; gap: 4px 8px; font-size: 13px;
}
.summary-grid .k { color: var(--sub, #999); }
.summary-grid .v-role { color: var(--sakura, #a08080); }
.summary-grid .v-time { color: var(--purple, #5a7a65); }
.summary-grid .v-price { font-size: 16px; color: var(--sakura, #a08080); }
.summary-grid .v-deposit { color: var(--peach, #8a7040); }
.hint-danger { font-size: 11px; color: var(--danger, #c98a8a); margin-top: 6px; }

/* ─── 成功 ─── */
.success-panel {
  background: rgba(255,255,255,0.72); backdrop-filter: blur(12px);
  margin: 10px 14px; border-radius: 18px; padding: 24px 16px; text-align: center;
  border: 1px solid rgba(123,168,130,0.3);
}
.success-panel h2 { color: var(--mint, #5a7a60); margin-bottom: 12px; }
.order-no-box { margin: 8px 0; font-size: 14px; }
.order-no-label { font-size: 11px; color: var(--sub); display: block; }
.lock-badges { display: flex; gap: 8px; justify-content: center; margin: 8px 0; }
.badge {
  font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: 600;
}
.badge-blue { background: #edf2f6; color: #5a7a96; }
.badge-warn { background: #fff3e0; color: #e67a2e; animation: badgePulse 2s ease-in-out infinite; }
.badge-lock { background: #f5f0e8; color: #8a7040; }
.time-confirm { margin: 10px 0; font-size: 16px; }
.time-confirm-sub { font-size: 12px; color: var(--sub); margin-top: 4px; }
.lock-notice { font-size: 12px; color: var(--sub); }

/* ─── 收款码展示（成功面板）─── */
.qr-section {
  margin: 16px 0 10px; padding: 14px;
  background: #FAFAF8; border-radius: 14px;
  border: 1px solid rgba(180,185,182,0.15);
}
.qr-section-title {
  font-size: 13px; font-weight: 600; color: #4A4A4A; margin-bottom: 10px;
}
.qr-preview {
  width: 100%; max-width: 200px; border-radius: 12px;
  border: 1px solid rgba(125,158,138,0.15);
}
.qr-row-inline { display: flex; gap: 12px; justify-content: center; }
.qr-item-inline { text-align: center; }
.qr-preview-sm { width: 120px; border-radius: 10px; border: 1px solid rgba(125,158,138,0.12); }
.qr-tag { display: block; font-size: 11px; font-weight: 600; margin-top: 2px; }
.qr-tag.alipay { color: #1677ff; }
.qr-tag.wechat { color: #07c160; }
.qr-save-hint {
  font-size: 11px; color: #8E8E8E; margin-top: 8px; margin-bottom: 0;
}

/* ─── 按钮 ─── */
.btn-primary {
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  color: #fff; border: none; border-radius: 28px; padding: 12px 24px;
  font-size: 15px; font-weight: 700; cursor: pointer; transition: all .2s;
  box-shadow: 0 4px 16px rgba(244,164,96,0.22);
}
.btn-primary:disabled { opacity: .4; cursor: not-allowed; }
.btn-secondary {
  background: #fff; border: 1px solid #E8E5DF; border-radius: 28px;
  padding: 12px 24px; font-size: 15px; cursor: pointer; color: #4A4A4A;
}
.lock-hint { text-align: center; font-size: 11px; color: var(--sub); }
.error-bar {
  margin: 0 14px; padding: 10px 14px; border-radius: 10px;
  background: #FDF2F2; color: #C87878; font-size: 13px;
}

/* ─── 弹窗 ─── */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.modal-box {
  background: #fff; border-radius: 20px; padding: 28px 24px;
  max-width: 380px; width: 90%; text-align: center; max-height: 90vh; overflow-y: auto;
}
.modal-amount {
  font-size: 32px; font-weight: 800;
  background: linear-gradient(135deg, var(--sakura, #a08080), var(--purple, #5a7a65));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text; margin: 10px 0;
}
.qr-row { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin: 14px 0; }
.qr-item { flex: 1; min-width: 120px; }
.qr-img { width: 100%; max-width: 160px; border-radius: 14px; border: 1.5px solid rgba(125,158,138,0.15); }
.qr-label { font-size: 12px; font-weight: 600; margin-top: 4px; }
.qr-label.alipay { color: #1677ff; }
.qr-label.wechat { color: #07c160; }
.qr-label.default { color: var(--purple, #5a7a65); }
.no-qr { padding: 24px; color: var(--sub, #8e8e93); font-size: 13px; }
.qr-hint { font-size: 11px; color: var(--sub, #8e8e93); margin: 8px 0; }
.modal-actions { display: flex; gap: 8px; margin-top: 14px; }
@keyframes badgePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.opt-tag { font-size:11px; color:var(--text-sub,#8e8e93); font-weight:400; }
.upload-card {
  display:flex; align-items:center; justify-content:center;
  padding:28px 20px; border:2px dashed #E0DCD5; border-radius:16px;
  cursor:pointer; background:rgba(255,255,255,.5); color:#aaa; font-size:14px;
  transition:all .2s;
}
.upload-card:hover { border-color:#D4893E; color:#D4893E; background:rgba(254,247,239,.5); }
.upload-spin { animation: spin 1s linear infinite; }
.preview-card {
  position:relative; display:inline-block; border-radius:14px; overflow:hidden;
  box-shadow:0 2px 12px rgba(0,0,0,.08);
}
.preview-thumb { width:160px; height:160px; object-fit:cover; display:block; }
.preview-remove {
  position:absolute; top:4px; right:4px; width:24px; height:24px;
  border:none; background:rgba(0,0,0,.45); color:#fff; border-radius:50%;
  font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.ref-grid { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
.ref-thumb-wrap {
  position:relative; width:80px; height:80px; border-radius:12px; overflow:hidden;
  box-shadow:0 2px 8px rgba(0,0,0,.06);
}
.ref-thumb { width:100%; height:100%; object-fit:cover; }
.ref-add {
  width:80px; height:80px; padding:0; font-size:28px; font-weight:300;
  border-radius:12px;
}
.ref-count { font-size:12px; color:var(--text-sub,#8e8e93); margin-top:8px; text-align:right; }
@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
</style>
