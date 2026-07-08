<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClientAuthStore } from '@/stores/clientAuth'
import { storage, getQueryParam } from '@/utils/storage'
import { ElMessage } from 'element-plus'
import FlexibleTimelinePicker from '@/components/client/FlexibleTimelinePicker.vue'

const route = useRoute()
const router = useRouter()
const auth = useClientAuthStore()

// 辅助：HH:mm → minutes
function toMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const mId = getQueryParam('mId') || storage.get('mzg_client_mid', '')

// ── 状态配置（与 MyOrdersView 一致） ──
const statusConfig = {
  PENDING_DEPOSIT: { label: '待付定金', cls: 's-pending' },
  DEPOSIT_PAID:    { label: '已付定金', cls: 's-active' },
  COMPLETED:       { label: '已结清',   cls: 's-done' },
  REFUNDED:        { label: '已退款',   cls: 's-cancel' },
  UPCOMING:        { label: '待服务',   cls: 's-pending' },
  UNSETTLED:       { label: '未结清',   cls: 's-warn' },
  FULFILLED:       { label: '已完成',   cls: 's-done' },
  CANCELLED:       { label: '已取消',   cls: 's-cancel' },
  RESCHEDULE_REQUESTED: { label: '改期审核中', cls: 's-warn' },
  CANCEL_REQUESTED:     { label: '取消审核中', cls: 's-warn' },
}

function statusBadge(order) {
  if (!order) return { label: '未知', cls: '' }
  if (order.status === '定金待确认') return { label: '定金待确认', cls: 's-warn' }
  if (order.status === '未结清') return statusConfig.UNSETTLED
  if (order.status === '待支付') return statusConfig.PENDING_DEPOSIT
  if (order.status === '已付定金') return statusConfig.DEPOSIT_PAID
  if (order.status === '已确认锁定') return { label: '已确认', cls: 's-active' }
  if (order.status === '已完成拍摄') return statusConfig.FULFILLED
  if (order.status === '已取消') return statusConfig.CANCELLED
  if (order.status === '已退款取消') return statusConfig.REFUNDED
  if (order.status === '退款审核中') return { label: '退款审核中', cls: 's-warn' }
  if (order.serviceStatus === 'CANCELLED') return statusConfig.CANCELLED
  if (order.paymentStatus === 'REFUNDED') return statusConfig.REFUNDED
  if (order.applicationStatus && order.applicationStatus !== 'NONE') {
    return statusConfig[order.applicationStatus] || { label: order.applicationStatus, cls: 's-warn' }
  }
  if (order.serviceStatus === 'FULFILLED') return statusConfig.FULFILLED
  return statusConfig[order.paymentStatus] || { label: order.status || '未知', cls: '' }
}

// ── 按钮显隐逻辑 ──
function canPay(order) {
  if (!order) return false
  return order.paymentStatus === 'PENDING_DEPOSIT' || order.paymentStatus === 'DEPOSIT_PAID'
}
function canReschedule(order) {
  if (!order) return false
  return order.serviceStatus === 'UPCOMING' &&
    (order.applicationStatus === 'NONE' || !order.applicationStatus)
}
function canCancel(order) {
  if (!order) return false
  return order.serviceStatus === 'UPCOMING' &&
    (order.applicationStatus === 'NONE' || !order.applicationStatus)
}
function hasActiveApplication(order) {
  if (!order) return false
  return order.applicationStatus && order.applicationStatus !== 'NONE'
}

// ── 数据加载 ──
const order = ref(null)
const loading = ref(true)
const errorMsg = ref('')

async function fetchDetail() {
  const orderNo = route.params.id
  if (!orderNo || !mId) {
    loading.value = false
    errorMsg.value = '缺少订单号或商家ID'
    return
  }
  loading.value = true
  try {
    const res = await fetch(
      `/api/order-detail?orderNo=${encodeURIComponent(orderNo)}&mId=${encodeURIComponent(mId)}`,
      mId ? { headers: auth.getAuthHeaders() } : {}
    ).then(r => r.json())
    if (res.success || res.code === 0) {
      order.value = res.data || null
    } else {
      errorMsg.value = res.message || '查询失败'
    }
  } catch {
    errorMsg.value = '网络错误'
  }
  loading.value = false
}

onMounted(() => fetchDetail())

// ── 收款码 ──
const merchantSettings = ref({})
onMounted(async () => {
  if (!mId) return
  try {
    const res = await fetch(`/api/settings?mId=${mId}`).then(r => r.json())
    if (res.success || res.code === 0) merchantSettings.value = res.data || {}
  } catch {}
})

// ── 支付弹窗 ──
const payModalOpen = ref(false)
function openPayModal() { payModalOpen.value = true }

// ── 改期弹窗 ──
const reschedModalOpen = ref(false)
const reschedStartTime = ref('')
const reschedConflictMsg = ref('')
const reschedSubmitting = ref(false)
const reschedUnavailable = ref([])
const reschedBaseStart = ref('09:00')
const reschedBaseEnd = ref('18:00')
const reschedLoading = ref(false)

async function openReschedModal() {
  reschedModalOpen.value = true
  reschedStartTime.value = ''
  reschedConflictMsg.value = ''
  reschedUnavailable.value = []
  reschedLoading.value = true

  try {
    const o = order.value
    const studioId = o.studioId || o.studio_id
    const date = o.date || o.order_date || ''
    if (studioId && date && mId) {
      const res = await fetch(
        `/api/booked-times-v2?mId=${mId}&studioId=${studioId}&date=${date}&excludeOrderNo=${encodeURIComponent(o.orderNo)}`
      ).then(r => r.json())
      const data = (res.data || res)
      const booked = (data.bookedRanges || []).map(b => ({
        start: b.start, end: b.end, type: 'booked', lockType: b.lockType || '',
        reason: b.lockType === 'hard_lock' ? '已确认' : '预锁', orderNo: b.orderNo || '',
      }))
      const rests = (data.restRanges || []).map(r => ({
        start: r.start, end: r.end, type: 'rest', reason: '休息',
      }))
      reschedUnavailable.value = [...booked, ...rests]
      reschedBaseStart.value = data.baseStartTime || '09:00'
      reschedBaseEnd.value = data.baseEndTime || '18:00'
    }
  } catch { reschedUnavailable.value = [] }
  reschedLoading.value = false
}

async function submitReschedule() {
  const o = order.value
  if (!o || !reschedStartTime.value) return
  reschedSubmitting.value = true
  reschedConflictMsg.value = ''
  try {
    const res = await fetch('/api/order/request-reschedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.getAuthHeaders() },
      body: JSON.stringify({ orderNo: o.orderNo, requestedNewTime: reschedStartTime.value }),
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      reschedModalOpen.value = false
      await fetchDetail()
      ElMessage.success('改期申请已提交')
    } else {
      reschedConflictMsg.value = res.message || '申请失败'
    }
  } catch (e) {
    reschedConflictMsg.value = e?.message || '网络错误'
  } finally {
    reschedSubmitting.value = false
  }
}

// ── 取消弹窗 ──
const cancelModalOpen = ref(false)
const cancelSubmitting = ref(false)

async function submitCancel() {
  const o = order.value
  if (!o) return
  cancelSubmitting.value = true
  try {
    const res = await fetch('/api/order/request-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.getAuthHeaders() },
      body: JSON.stringify({ orderNo: o.orderNo }),
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      cancelModalOpen.value = false
      await fetchDetail()
      ElMessage.success('取消申请已提交')
    } else {
      ElMessage.warning(res.message || '操作失败')
    }
  } catch (e) {
    ElMessage.error('网络错误，请稍后重试')
  }
  cancelSubmitting.value = false
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="order-detail-view fade-in-up" style="max-width:520px;margin:0 auto;padding:0 0 20px;">
    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">加载中...</div>

    <!-- 错误 -->
    <div v-else-if="errorMsg" class="error-state">
      <div class="empty-icon">😕</div>
      <p class="empty-title">{{ errorMsg }}</p>
      <button class="empty-btn" @click="goBack">返回</button>
    </div>

    <!-- 订单详情 -->
    <template v-else-if="order">
      <div class="order-card">
        <div class="card-top">
          <span class="card-title">{{ order.studioTitle || '预约项目' }}</span>
          <span class="card-badge" :class="statusBadge(order).cls">
            {{ statusBadge(order).label }}
          </span>
        </div>

        <div class="card-meta">
          <span v-if="order.roleName">{{ order.roleName }}</span>
          <span>{{ order.date }}</span>
          <span class="card-time">
            {{ order.bookingStartTime || '—' }}
            <template v-if="order.bookingEndTime"> — {{ order.bookingEndTime }}</template>
          </span>
        </div>

        <!-- 联系信息 -->
        <div v-if="order.contactNote" class="card-extra">
          <span class="extra-label">备注：</span>{{ order.contactNote }}
        </div>

        <!-- 金额明细 -->
        <div class="card-footer">
          <span class="card-price">
            总价 <strong>¥{{ order.totalPrice || '—' }}</strong>
            <span class="card-deposit"> 定金 ¥{{ order.depositAmount || 0 }}</span>
          </span>
          <span class="card-no">{{ order.orderNo }}</span>
        </div>

        <!-- 附加项 -->
        <div v-if="order.addonTotal > 0" class="card-extra">
          附加项目：+¥{{ order.addonTotal }}
        </div>

        <!-- 改期提示 -->
        <div v-if="order.applicationStatus === 'RESCHEDULE_REQUESTED' && order.requestedNewTime" class="card-reschedule">
          申请改期至 {{ order.requestedNewTime }}
        </div>

        <!-- 审核中提示 -->
        <div v-if="hasActiveApplication(order)" class="card-reviewing">
          商家审核中，请耐心等待...
        </div>

        <!-- 取消原因（已取消时展示） -->
        <div v-if="(order.status === '已取消' || order.serviceStatus === 'CANCELLED') && order.cancelReason" class="card-cancel-reason">
          取消原因：{{ order.cancelReason }}
        </div>

        <!-- ★ 操作按钮 -->
        <div class="card-actions" @click.stop>
          <button v-if="canPay(order)" class="act-btn act-pay" @click="openPayModal">
            {{ order.paymentStatus === 'DEPOSIT_PAID' ? '支付尾款' : '支付定金' }}
          </button>
          <button v-if="canReschedule(order)" class="act-btn act-resched" @click="openReschedModal">
            改时间
          </button>
          <button v-if="canCancel(order)" class="act-btn act-cancel" @click="cancelModalOpen = true">
            取消订单
          </button>
        </div>
      </div>

      <button class="back-home-btn" @click="goBack">← 返回列表</button>
    </template>
  </div>

  <!-- ═══ 支付弹窗 ═══ -->
  <Teleport to="body">
    <div v-if="payModalOpen" class="modal-overlay" @click.self="payModalOpen = false">
      <div class="modal-box">
        <h3>{{ order.paymentStatus === 'DEPOSIT_PAID' ? '支付尾款' : '支付定金' }}</h3>
        <div class="modal-amount">
          ¥{{ order.paymentStatus === 'DEPOSIT_PAID'
            ? ((order.totalPrice || 0) - (order.depositAmount || 0))
            : (order.depositAmount || 0) }}
        </div>
        <div v-if="merchantSettings.paymentQrCode || merchantSettings.alipayQrUrl || merchantSettings.wechatQrUrl" class="modal-qr">
          <img v-if="merchantSettings.paymentQrCode" :src="merchantSettings.paymentQrCode" class="qr-img" alt="收款码" />
          <div v-else class="qr-dual">
            <div v-if="merchantSettings.alipayQrUrl">
              <img :src="merchantSettings.alipayQrUrl" class="qr-img-sm" />
              <p class="qr-tag alipay">支付宝</p>
            </div>
            <div v-if="merchantSettings.wechatQrUrl">
              <img :src="merchantSettings.wechatQrUrl" class="qr-img-sm" />
              <p class="qr-tag wechat">微信</p>
            </div>
          </div>
          <p class="qr-hint">请扫码支付后联系商家确认</p>
        </div>
        <div v-else class="modal-no-qr">商家暂未上传收款码，请联系商家</div>
        <button class="modal-close-btn" @click="payModalOpen = false">关闭</button>
      </div>
    </div>
  </Teleport>

  <!-- ═══ 改期弹窗 ═══ -->
  <Teleport to="body">
    <div v-if="reschedModalOpen" class="modal-overlay" @click.self="reschedModalOpen = false">
      <div class="modal-box modal-wide">
        <h3>申请改期</h3>
        <p class="modal-sub">
          原时间：{{ order.date }} {{ order.bookingStartTime }}—{{ order.bookingEndTime }}
        </p>
        <div v-if="reschedLoading" style="text-align:center;padding:20px;color:#8E8E8E;">加载时间轴...</div>
        <FlexibleTimelinePicker
          v-else
          :open-time="reschedBaseStart"
          :close-time="reschedBaseEnd"
          :unavailable-slots="reschedUnavailable"
          :required-duration="order.bookingStartTime && order.bookingEndTime
            ? toMin(order.bookingEndTime) - toMin(order.bookingStartTime)
            : 60"
          :selected-start-time="reschedStartTime"
          :step="1"
          @update:selected-start-time="reschedStartTime = $event"
        />
        <div v-if="reschedConflictMsg" class="resched-err">{{ reschedConflictMsg }}</div>
        <div class="modal-actions">
          <button class="act-btn act-cancel" @click="reschedModalOpen = false">取消</button>
          <button class="act-btn act-pay" :disabled="!reschedStartTime || reschedSubmitting" @click="submitReschedule">
            {{ reschedSubmitting ? '提交中...' : '确认申请' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ═══ 取消确认弹窗 ═══ -->
  <Teleport to="body">
    <div v-if="cancelModalOpen" class="modal-overlay" @click.self="cancelModalOpen = false">
      <div class="modal-box">
        <h3>确认取消</h3>
        <p class="modal-sub">您确定要申请取消此订单吗？</p>
        <p class="modal-sub" style="font-size:11px;color:#8E8E8E;">
          {{ order.studioTitle }} / {{ order.date }}
        </p>
        <div class="modal-actions">
          <button class="act-btn act-resched" @click="cancelModalOpen = false">再想想</button>
          <button class="act-btn act-cancel" :disabled="cancelSubmitting" @click="submitCancel">
            {{ cancelSubmitting ? '提交中...' : '确认取消' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.order-detail-view { min-height: 60vh; }

/* ─── 加载 / 错误 ─── */
.loading-state { text-align: center; padding: 80px 0; color: #8E8E8E; font-size: 14px; }
.error-state { text-align: center; padding: 80px 20px; }

/* ─── 订单卡片 ─── */
.order-card {
  margin: 10px 14px; padding: 16px; border-radius: 16px;
  background: rgba(255,255,255,0.72); backdrop-filter: blur(12px);
  border: 1px solid rgba(180,185,182,0.18);
  box-shadow: 0 2px 8px rgba(120,130,125,0.03);
}
.card-top {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 12px;
}
.card-title { font-size: 17px; font-weight: 700; color: #3A3A4A; }

.card-badge {
  font-size: 10px; font-weight: 700; padding: 3px 10px;
  border-radius: 12px; white-space: nowrap; flex-shrink: 0;
}
.s-pending { background: #FFF3E0; color: #E67E22; }
.s-active  { background: #E3F2FD; color: #1976D2; }
.s-done    { background: #E8F5E9; color: #388E3C; }
.s-cancel  { background: #F5F5F5; color: #999; }
.s-warn    { background: #FFF8E1; color: #F9A825; }

.card-meta {
  display: flex; gap: 12px; flex-wrap: wrap;
  font-size: 12px; color: #8E8E8E; margin-bottom: 8px;
}
.card-time { color: #5a7a65; font-weight: 600; }

.card-extra {
  font-size: 12px; color: #8E8E8E; margin: 4px 0; padding: 6px 10px;
  background: #F8F8F8; border-radius: 8px;
}
.extra-label { font-weight: 600; color: #6E6E73; }

.card-footer {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; margin: 8px 0 4px;
}
.card-price { color: #6E6E73; }
.card-price strong { font-size: 14px; color: #D4893E; }
.card-deposit { color: #B0B0B0; }
.card-no { font-size: 10px; color: #C0C0C0; font-family: monospace; }

.card-reschedule {
  margin-top: 6px; padding: 6px 10px; border-radius: 8px;
  background: #FFF8E1; color: #F9A825; font-size: 11px; font-weight: 500;
}
.card-reviewing {
  margin-top: 6px; padding: 6px 10px; border-radius: 8px;
  background: #F5F5F5; color: #999; font-size: 12px; text-align: center;
}
.card-cancel-reason {
  margin-top: 6px; padding: 6px 10px; border-radius: 8px;
  background: #FDF2F2; color: #C87878; font-size: 12px;
}

/* ─── 操作按钮 ─── */
.card-actions {
  display: flex; gap: 8px; margin-top: 10px; padding-top: 10px;
  border-top: 1px solid #F0EDE8;
}
.act-btn {
  flex: 1; padding: 8px 0; border-radius: 10px; border: 1px solid #E8E5DF;
  font-size: 12px; font-weight: 600; cursor: pointer;
  background: #fff; font-family: inherit;
  transition: all 0.15s;
}
.act-btn:active { transform: scale(0.96); }
.act-pay     { color: #D4893E; border-color: #F4A460; }
.act-pay:hover:not(:disabled) { background: #FEF7EF; }
.act-resched { color: #5a7a65; }
.act-resched:hover:not(:disabled) { background: #e8f0eb; }
.act-cancel  { color: #C87878; border-color: rgba(200,120,120,0.3); }
.act-cancel:hover:not(:disabled) { background: #FDF2F2; }
.act-btn:disabled { opacity: .4; cursor: not-allowed; }

.back-home-btn {
  display: block; margin: 16px auto; padding: 10px 24px;
  border: 1px solid #E8E5DF; border-radius: 24px;
  background: #fff; color: #6E6E73; font-size: 13px; cursor: pointer; font-family: inherit;
  transition: all 0.15s;
}
.back-home-btn:hover { background: #F8F8F8; }

/* ─── 空状态 ─── */
.empty-icon { font-size: 56px; margin-bottom: 12px; }
.empty-title { font-size: 16px; font-weight: 700; color: #4A4A4A; margin-bottom: 4px; }
.empty-btn {
  padding: 10px 32px; border-radius: 24px; border: none;
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
  font-family: inherit; box-shadow: 0 4px 16px rgba(244,164,96,0.22);
}

/* ─── 弹窗 ─── */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;
}
.modal-box {
  background: #fff; border-radius: 20px; padding: 28px 24px;
  max-width: 380px; width: 90%; max-height: 85vh; overflow-y: auto;
}
.modal-wide { max-width: 480px; }
.modal-box h3 { font-size: 18px; margin-bottom: 8px; text-align: center; }
.modal-sub { font-size: 13px; color: #8E8E8E; margin-bottom: 12px; text-align: center; }
.modal-amount {
  font-size: 28px; font-weight: 800; text-align: center; margin: 10px 0;
  color: #D4893E;
}

.modal-qr { text-align: center; margin: 12px 0; }
.qr-img { max-width: 200px; border-radius: 12px; border: 1px solid #F0EDE8; }
.qr-img-sm { width: 110px; border-radius: 10px; border: 1px solid #F0EDE8; }
.qr-dual { display: flex; gap: 12px; justify-content: center; }
.qr-tag { font-size: 11px; font-weight: 600; margin-top: 4px; }
.qr-tag.alipay { color: #1677ff; }
.qr-tag.wechat { color: #07c160; }
.qr-hint { font-size: 11px; color: #8E8E8E; margin-top: 8px; }
.modal-no-qr { text-align: center; padding: 24px; color: #8E8E8E; font-size: 13px; }

.modal-actions { display: flex; gap: 8px; margin-top: 16px; }
.modal-actions .act-btn { flex: 1; padding: 12px; font-size: 14px; }

.modal-close-btn {
  display: block; width: 100%; margin-top: 12px; padding: 10px;
  border: 1px solid #E8E5DF; border-radius: 12px;
  background: #fff; font-size: 14px; cursor: pointer; font-family: inherit;
}

.resched-err {
  margin-top: 8px; padding: 8px 12px; border-radius: 8px;
  background: #FDF2F2; color: #C87878; font-size: 12px; text-align: center;
}
</style>
