<template>
  <div class="booking-step2 fade-in-up">
    <h4>窗口 2 — 角色信息与确认锁定</h4>

    <!-- 订单摘要 -->
    <div class="order-summary">
      <div class="summary-title">订单摘要</div>
      <div class="summary-row" v-if="store.studio.isStyleEnabled && selectedStyle">
        <span>样式</span><strong>{{ selectedStyle.styleName }}</strong>
      </div>
      <div class="summary-row">
        <span>类型</span><strong>{{ store.optType === 'single' ? '按单张(' + store.photoCount + '张)' : '套餐' }}</strong>
      </div>
      <div class="summary-row">
        <span>日期</span><strong>{{ store.bookingStartDate }}</strong>
      </div>
      <div class="summary-row">
        <span>时间</span><strong>{{ store.bookingStartTime }} - {{ store.bookingEndTime }}</strong>
      </div>
      <div class="summary-row price">
        <span>总价</span><strong>¥{{ store.totalPrice }}</strong>
      </div>
      <div class="summary-row deposit">
        <span>定金 ({{ store.studio.depositRatio || 30 }}%)</span><strong>¥{{ store.depositAmount }}</strong>
      </div>
    </div>

    <!-- 表单 -->
    <el-form label-width="100px" style="margin-top:16px;">
      <el-form-item label="角色名称" required>
        <el-input v-model="store.roleName" placeholder="如：钟离" maxlength="256" />
      </el-form-item>
      <el-form-item label="联系方式" required>
        <div class="contact-type-row" style="display:flex;gap:6px;margin-bottom:8px;">
          <el-button
            v-for="ct in CONTACT_TYPES" :key="ct.key"
            size="small"
            :type="contactType === ct.key ? 'primary' : ''"
            @click="contactType = ct.key"
          >{{ ct.label }}</el-button>
        </div>
        <el-input
          v-model="contactValue"
          :placeholder="(CONTACT_TYPES.find(c => c.key === contactType) || CONTACT_TYPES[0]).placeholder"
          maxlength="128"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="store.contactNote" type="textarea" :rows="2" placeholder="其他需求（选填）" maxlength="512" />
      </el-form-item>
    </el-form>

    <!-- 双重锁定说明 -->
    <div class="lock-info">
      <div class="lock-step">
        <span class="lock-badge pre">第一重</span> 支付定金后，时间段将标记为 <b>定金锁定 (pre_lock)</b>，他人不可预约
      </div>
      <div class="lock-step">
        <span class="lock-badge hard">第二重</span> 摄影师确认后，升级为 <b>确认锁定 (hard_lock)</b>，正式排入工作列表
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="step-footer">
      <el-button @click="store.prevStep()">上一步</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!store.roleName.trim() || !contactType || !contactValue.trim()"
        @click="handleSubmit"
      >
        提交订单并支付定金
      </el-button>
    </div>

    <!-- 支付弹窗 -->
    <el-dialog v-model="payVisible" title="支付定金" width="380px">
      <div class="pay-content">
        <p>应付定金: <b>¥{{ store.depositAmount }}</b></p>
        <p style="font-size:13px;color:#999;">请线下转账后点击确认</p>
        <el-button type="primary" :loading="paying" @click="handlePay">我已支付定金</el-button>
      </div>
    </el-dialog>

    <!-- 强制声明弹窗 -->
    <DeclarationDialog v-model="showDeclaration" :content="declarationContent" :studio-id="studioId" @close="onDeclarationClose" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBookingStore } from '@/stores/booking'
import { useSettingsStore } from '@/stores/settings'
import { storage, getQueryParam } from '@/utils/storage'
import DeclarationDialog from '@/components/shared/DeclarationDialog.vue'

const store = useBookingStore()
const settingsStore = useSettingsStore()
const router = useRouter()
const route = useRoute()

const studioId = computed(() => parseInt(route.params.studioId) || null)
const submitting = ref(false)
const paying = ref(false)
const payVisible = ref(false)

// ── 联系方式 ──
const CONTACT_TYPES = [
  { key: 'qq',     label: 'QQ',       placeholder: '请输入QQ号' },
  { key: 'wechat', label: '微信',     placeholder: '请输入微信号' },
  { key: 'phone',  label: '手机号',   placeholder: '请输入手机号' },
  { key: 'other',  label: '其他',     placeholder: '请备注网站/平台名称' },
]
const contactType = ref(store.contactType || '')
const contactValue = ref(store.contactValue || '')

// ── 声明弹窗 ──
const showDeclaration = ref(false)
const declarationContent = ref('')

onMounted(async () => {
  const mId = getQueryParam('mId') || storage.get('mzg_client_mid', '')
  await settingsStore.fetch(mId)
})

const selectedStyle = computed(() => {
  if (!store.studio?.styles) return null
  return store.studio.styles.find(s => s.id === store.selectedStyleId)
})

async function handleSubmit() {
  if (!contactType.value) { return }
  if (!contactValue.value.trim()) { return }
  store.contactType = contactType.value
  store.contactValue = contactValue.value.trim()
  // 检查弹窗声明
  if (settingsStore.declarationEnabled && settingsStore.declarationContent) {
    declarationContent.value = settingsStore.declarationContent
    showDeclaration.value = true
    return
  }
  await doSubmit()
}

async function doSubmit() {
  submitting.value = true
  try {
    const deviceId = storage.get('mzg_device_id', '') || 'device_' + Date.now()
    const mId = getQueryParam('mId') || storage.get('mzg_client_mid', '')
    const result = await store.submitOrder(deviceId, mId)
    if (result) {
      payVisible.value = true
    }
  } finally {
    submitting.value = false
  }
}

function onDeclarationClose() {
  showDeclaration.value = false
  doSubmit()
}

async function handlePay() {
  paying.value = true
  try {
    const mId = getQueryParam('mId') || storage.get('mzg_client_mid', '')
    const ok = await store.submitPayDeposit(mId)
    if (ok) {
      payVisible.value = false
      router.push({ name: 'MyOrders' })
    }
  } finally {
    paying.value = false
  }
}
</script>

<style scoped>
.booking-step2 { max-width: 500px; }
h4 { margin-bottom: 16px; }
.order-summary { background: var(--bg-table-stripe, #fafafa); border-radius: 10px; padding: 14px; }
.summary-title { font-weight: 700; margin-bottom: 8px; }
.summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 14px; }
.summary-row.price strong { color: #5a7a65; font-size: 16px; }
.summary-row.deposit strong { color: #b8860b; }
.lock-info { margin-top: 16px; }
.lock-step { font-size: 13px; padding: 8px 12px; background: var(--color-disabled-bg, #F4F2EE); border-radius: 10px; margin-bottom: 6px; }
.lock-badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; margin-right: 6px; }
.lock-badge.pre { background: var(--color-peach-light, #FEFBF6); color: #B8933E; }
.lock-badge.hard { background: var(--color-success-bg, #EDF6F0); color: #5A8A6A; }
.step-footer { display: flex; justify-content: space-between; margin-top: 24px; }
.pay-content { text-align: center; padding: 10px 0; }
</style>
