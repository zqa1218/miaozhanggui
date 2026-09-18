<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/order'
import { useClientAuthStore } from '@/stores/clientAuth'
import { storage, getQueryParam } from '@/utils/storage'
import { ElMessage } from 'element-plus'
import FlexibleTimelinePicker from '@/components/client/FlexibleTimelinePicker.vue'
import AppIllustration from '@/components/shared/AppIllustration.vue'

const router = useRouter()
const store = useOrderStore()
const auth = useClientAuthStore()

// 辅助：HH:mm → minutes
function toMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const mId = computed(() => getQueryParam('mId') || storage.get('mzg_client_mid', ''))
const deviceId = computed(() => storage.get('mzg_device_id', '') || ('dev_' + Date.now().toString(36)))

// ── 状态配置 ──
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
  // 旧 status 字段优先映射
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
  return order.paymentStatus === 'PENDING_DEPOSIT' || order.paymentStatus === 'DEPOSIT_PAID'
}
function canReschedule(order) {
  return order.serviceStatus === 'UPCOMING' &&
    (order.applicationStatus === 'NONE' || !order.applicationStatus)
}
function canCancel(order) {
  return order.serviceStatus === 'UPCOMING' &&
    (order.applicationStatus === 'NONE' || !order.applicationStatus)
}
function hasActiveApplication(order) {
  return order.applicationStatus && order.applicationStatus !== 'NONE'
}

// ── 分离有效订单与已取消订单 ──
const activeOrders = computed(() =>
  myOrders.value.filter(o =>
    o.status !== '已取消' && o.status !== '已退款取消' &&
    o.serviceStatus !== 'CANCELLED' && o.paymentStatus !== 'REFUNDED'
  )
)
const cancelledOrders = computed(() =>
  myOrders.value.filter(o =>
    o.status === '已取消' || o.status === '已退款取消' ||
    o.serviceStatus === 'CANCELLED' || o.paymentStatus === 'REFUNDED'
  )
)

// ── 数据加载 ──
async function refreshOrders() {
  if (!mId.value) return

  // ★ 已登录：使用 JWT API（userId + mId 双重隔离）
  if (auth.isLoggedIn) {
    try {
      const res = await fetch(`/api/my-orders?mId=${mId.value}`, {
        headers: auth.getAuthHeaders(),
      }).then(r => r.json())
      if (res.success || res.code === 0) {
        myOrders.value = res.data || []
      }
    } catch {}
    return
  }

  // 未登录：旧版 deviceId 兼容
  if (deviceId.value) {
    await store.fetchMyOrders(mId.value, deviceId.value)
    myOrders.value = store.myOrders || []
  }
}

const myOrders = ref([])
const loading = ref(false)

onMounted(async () => {
  if (mId.value && deviceId.value) {
    storage.set('mzg_device_id', deviceId.value)
    try {
      const res = await fetch(`/api/settings?mId=${mId.value}`).then(r => r.json())
      if (res.success || res.code === 0) merchantSettings.value = res.data || {}
    } catch {}
    await refreshOrders()
  }
})

const refreshBus = inject('refreshBus', null)
watch(() => refreshBus?.tick, () => refreshOrders())

// ── 收款码 ──
const merchantSettings = ref({})

// ── 支付弹窗 ──
const payModalOrder = ref(null)
function openPayModal(order) { payModalOrder.value = order }

// ── 改期弹窗 ──
const reschedModalOrder = ref(null)
const reschedStartTime = ref('')
const reschedConflictMsg = ref('')
const reschedSubmitting = ref(false)
const reschedUnavailable = ref([])
const reschedBaseStart = ref('09:00')
const reschedBaseEnd = ref('18:00')
const reschedLoading = ref(false)

async function openReschedModal(order) {
  reschedModalOrder.value = order
  reschedStartTime.value = ''
  reschedConflictMsg.value = ''
  reschedUnavailable.value = []
  reschedLoading.value = true

  // 拉取当天已被占用时间段（后端按 excludeOrderNo 自动剔除当前订单自身）
  try {
    const studioId = order.studioId || order.studio_id
    const date = order.date || order.order_date || ''
    if (studioId && date && mId.value) {
      const res = await fetch(
        `/api/booked-times-v2?mId=${mId.value}&studioId=${studioId}&date=${date}&excludeOrderNo=${encodeURIComponent(order.orderNo)}`
      ).then(r => r.json())
      const data = (res.data || res)
      const booked = (data.bookedRanges || []).map(b => ({
        start: b.start, end: b.end,
        type: 'booked', lockType: b.lockType || '',
        reason: b.lockType === 'hard_lock' ? '已确认' : '预锁',
        orderNo: b.orderNo || '',
      }))
      const rests = (data.restRanges || []).map(r => ({
        start: r.start, end: r.end,
        type: 'rest', reason: '休息',
      }))

      reschedUnavailable.value = [...booked, ...rests]
      reschedBaseStart.value = data.baseStartTime || '09:00'
      reschedBaseEnd.value = data.baseEndTime || '18:00'
    }
  } catch { reschedUnavailable.value = [] }
  reschedLoading.value = false
}

async function submitReschedule() {
  const order = reschedModalOrder.value
  if (!order || !reschedStartTime.value) return
  reschedSubmitting.value = true
  reschedConflictMsg.value = ''
  try {
    const res = await store.requestRescheduleAction({
      orderNo: order.orderNo,
      requestedNewTime: reschedStartTime.value,
      userDeviceId: deviceId.value,
    })
    if (res.success || res.code === 0) {
      reschedModalOrder.value = null
      await refreshOrders()
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
const cancelModalOrder = ref(null)
const cancelSubmitting = ref(false)

function openCancelModal(order) { cancelModalOrder.value = order }

async function submitCancel() {
  const order = cancelModalOrder.value
  if (!order) return
  cancelSubmitting.value = true
  try {
    const res = await store.requestCancelAction({
      orderNo: order.orderNo,
      userDeviceId: deviceId.value,
    })
    if (res.success || res.code === 0) {
      cancelModalOrder.value = null
      await refreshOrders()
    }
  } catch {}
  cancelSubmitting.value = false
}

function goBooking() {
  router.push('/studio-filter')
}
</script>

<template>
  <div class="my-orders fade-in-up page page--form">
    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">加载中...</div>

    <!-- 有效订单列表 -->
    <template v-else-if="activeOrders.length > 0 || cancelledOrders.length > 0">
      <div v-for="item in activeOrders" :key="item.id" class="order-card">
        <div class="card-top">
          <span class="card-title">{{ item.studioTitle || '预约项目' }}</span>
          <span class="card-badge" :class="statusBadge(item).cls">
            {{ statusBadge(item).label }}
          </span>
        </div>

        <div class="card-meta">
          <span v-if="item.roleName">{{ item.roleName }}</span>
          <span>{{ item.date }}</span>
          <span class="card-time">
            {{ item.bookingStartTime || '—' }}
            <template v-if="item.bookingEndTime"> — {{ item.bookingEndTime }}</template>
          </span>
        </div>

        <div class="card-footer">
          <span class="card-price">
            总价 <strong>¥{{ item.totalPrice || '—' }}</strong>
            <span class="card-deposit"> 定金 ¥{{ item.depositAmount || 0 }}</span>
          </span>
          <span class="card-no">{{ item.orderNo }}</span>
        </div>

        <!-- 改期提示 -->
        <div v-if="item.applicationStatus === 'RESCHEDULE_REQUESTED' && item.requestedNewTime" class="card-reschedule">
          申请改期至 {{ item.requestedNewTime }}
        </div>

        <!-- 审核中提示 -->
        <div v-if="hasActiveApplication(item)" class="card-reviewing">
          商家审核中，请耐心等待...
        </div>

        <!-- ★ 操作按钮 -->
        <div class="card-actions" @click.stop>
          <button v-if="canPay(item)" class="act-btn act-pay" @click="openPayModal(item)">
            {{ item.paymentStatus === 'DEPOSIT_PAID' ? '支付尾款' : '支付定金' }}
          </button>
          <button v-if="canReschedule(item)" class="act-btn act-resched" @click="openReschedModal(item)">
            改时间
          </button>
          <button v-if="canCancel(item)" class="act-btn act-cancel" @click="openCancelModal(item)">
            取消订单
          </button>
        </div>
      </div>

      <!-- ★ 已取消订单（折叠在底部） -->
      <div v-if="cancelledOrders.length > 0" class="cancelled-section">
        <div class="cancelled-header">已取消的订单 ({{ cancelledOrders.length }})</div>
        <div v-for="item in cancelledOrders" :key="item.id" class="order-card cancelled">
          <div class="card-top">
            <span class="card-title">{{ item.studioTitle || '预约项目' }}</span>
            <span class="card-badge s-cancel">{{ statusBadge(item).label }}</span>
          </div>
          <div class="card-meta">
            <span>{{ item.date }}</span>
            <span class="card-time">{{ item.bookingStartTime || '—' }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <AppIllustration name="empty-no-orders" :width="180" alt="暂无订单" />
      <p class="empty-title">您还没有订单</p>
      <p class="empty-sub">快去预约一个心仪的项目吧</p>
      <button class="empty-btn" @click="goBooking">去预约</button>
    </div>

    <!-- ═══ 支付弹窗 ═══ -->
    <Teleport to="body">
      <div v-if="payModalOrder" class="modal-overlay" @click.self="payModalOrder = null">
        <div class="modal-box">
          <h3>
            {{ payModalOrder.paymentStatus === 'DEPOSIT_PAID' ? '支付尾款' : '支付定金' }}
          </h3>
          <div class="modal-amount">
            ¥{{ payModalOrder.paymentStatus === 'DEPOSIT_PAID'
              ? ((payModalOrder.totalPrice || 0) - (payModalOrder.depositAmount || 0))
              : (payModalOrder.depositAmount || 0) }}
          </div>

          <div v-if="merchantSettings.paymentQrCode || merchantSettings.alipayQrUrl || merchantSettings.wechatQrUrl" class="modal-qr">
            <img
              v-if="merchantSettings.paymentQrCode"
              :src="merchantSettings.paymentQrCode"
              class="qr-img"
              alt="收款码"
            />
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

          <button class="modal-close-btn" @click="payModalOrder = null">关闭</button>
        </div>
      </div>
    </Teleport>

    <!-- ═══ 改期弹窗 ═══ -->
    <Teleport to="body">
      <div v-if="reschedModalOrder" class="modal-overlay" @click.self="reschedModalOrder = null">
        <div class="modal-box modal-wide">
          <h3>申请改期</h3>
          <p class="modal-sub">
            原时间：{{ reschedModalOrder.date }} {{ reschedModalOrder.bookingStartTime }}—{{ reschedModalOrder.bookingEndTime }}
          </p>

          <div v-if="reschedLoading" style="text-align:center;padding:20px;color:var(--text-3);">加载时间轴...</div>
          <FlexibleTimelinePicker
            v-else
            :open-time="reschedBaseStart"
            :close-time="reschedBaseEnd"
            :unavailable-slots="reschedUnavailable"
            :required-duration="reschedModalOrder.bookingStartTime && reschedModalOrder.bookingEndTime
              ? toMin(reschedModalOrder.bookingEndTime) - toMin(reschedModalOrder.bookingStartTime)
              : 60"
            :selected-start-time="reschedStartTime"
            :step="1"
            @update:selected-start-time="reschedStartTime = $event"
          />

          <div v-if="reschedConflictMsg" class="resched-err">{{ reschedConflictMsg }}</div>

          <div class="modal-actions">
            <button class="act-btn act-cancel" @click="reschedModalOrder = null">取消</button>
            <button class="act-btn act-pay" :disabled="!reschedStartTime || reschedSubmitting" @click="submitReschedule">
              {{ reschedSubmitting ? '提交中...' : '确认申请' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══ 取消确认弹窗 ═══ -->
    <Teleport to="body">
      <div v-if="cancelModalOrder" class="modal-overlay" @click.self="cancelModalOrder = null">
        <div class="modal-box">
          <h3>确认取消</h3>
          <p class="modal-sub">您确定要申请取消此订单吗？</p>
          <p class="modal-sub" style="font-size:11px;color:var(--text-3);">
            {{ cancelModalOrder.studioTitle }} / {{ cancelModalOrder.date }}
          </p>
          <div class="modal-actions">
            <button class="act-btn act-resched" @click="cancelModalOrder = null">再想想</button>
            <button class="act-btn act-cancel" :disabled="cancelSubmitting" @click="submitCancel">
              {{ cancelSubmitting ? '提交中...' : '确认取消' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.my-orders { min-height: 60vh; }

/* ─── 加载 ─── */
.loading-state { text-align: center; padding: 80px 0; color: var(--text-3); font-size: 14px; }

/* ─── 订单卡片 ───
   宫格/列表项不加 backdrop-filter：一屏多张时是纯粹的 GPU 浪费，
   半透明由 --surface-1 的 alpha 合成提供。 */
.order-card {
  margin: 0 0 var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-card);
  background: var(--surface-1);
  border: 1px solid var(--glass-hairline);
  box-shadow: var(--shadow-1);
  transition: box-shadow var(--duration-2) var(--ease-out);
}

.card-top {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: var(--space-2);
}
.card-title { font-size: 15px; font-weight: 700; color: var(--text-1); }

.card-badge {
  font-size: 11px; font-weight: 700; padding: 2px 10px;
  border-radius: var(--radius-pill); white-space: nowrap; flex-shrink: 0;
}
/* 状态徽章全部改为「tint 底 + ink 字」，原先用的是 Material 色板
   （#1976D2 / #388E3C / #F9A825…），与暖杏体系断裂且对比度未校准。 */
.s-pending { background: var(--color-warning-tint); color: var(--color-warning-ink); }
.s-active  { background: var(--color-info-tint);    color: var(--color-info-ink); }
.s-done    { background: var(--color-success-tint); color: var(--color-success-ink); }
.s-cancel  { background: var(--color-neutral-tint); color: var(--color-neutral-ink); }
.s-warn    { background: var(--color-danger-tint);  color: var(--color-danger-ink); }

.card-meta {
  display: flex; gap: var(--space-3); flex-wrap: wrap;
  font-size: 12px; color: var(--text-3); margin-bottom: var(--space-2);
}
.card-time { color: var(--color-primary-ink); font-weight: 600; }

.card-footer {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; margin-bottom: 4px;
}
.card-price { color: var(--text-3); }
.card-price strong { font-size: 14px; color: var(--color-primary-ink); }
.card-deposit { color: var(--text-3); }
.card-no { font-size: 11px; color: var(--text-3); font-family: var(--font-mono); }

.card-reschedule {
  margin-top: 6px; padding: 6px 10px; border-radius: var(--radius-sm);
  background: var(--color-warning-tint); color: var(--color-warning-ink);
  font-size: 11px; font-weight: 600;
}
.card-reviewing {
  margin-top: 6px; padding: 6px 10px; border-radius: var(--radius-sm);
  background: var(--color-neutral-tint); color: var(--color-neutral-ink);
  font-size: 12px; text-align: center;
}

/* ─── 操作按钮 ─── */
.card-actions {
  display: flex; gap: 8px; margin-top: 10px; padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
}
.act-btn {
  flex: 1; padding: 8px 0; border-radius: var(--radius-sm); border: 1px solid var(--border-color);
  font-size: 12px; font-weight: 600; cursor: pointer;
  background: var(--surface-solid); font-family: inherit;
  transition: all 0.15s;
}
.act-btn:active { transform: scale(0.96); }
.act-pay     { color: var(--color-primary-ink); border-color: var(--color-primary); }
.act-pay:hover:not(:disabled) { background: var(--color-primary-tint); }
.act-resched { color: var(--color-primary-ink); }
.act-resched:hover:not(:disabled) { background: var(--color-primary-tint); }
.act-cancel  { color: var(--color-danger-ink); border-color: rgba(200,120,120,0.3); }
.act-cancel:hover:not(:disabled) { background: var(--color-danger-tint); }
.act-btn:disabled { opacity: .4; cursor: not-allowed; }

/* ─── 已取消订单区域 ─── */
.cancelled-section { margin-top: 20px; }
.cancelled-header {
  margin: 0 14px 8px; font-size: 12px; font-weight: 600;
  color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px;
}
.order-card.cancelled { opacity: 0.55; }

/* ─── 空状态 ─── */
.empty-state { text-align: center; padding: 80px 20px; }
.empty-icon { font-size: 56px; margin-bottom: 12px; }
.empty-title { font-size: 16px; font-weight: 700; color: var(--text-1); margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: var(--text-3); margin-bottom: 20px; }
.empty-btn {
  padding: 10px 32px; border-radius: var(--radius-btn); border: none;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  color: var(--text-on-primary); font-size: 14px; font-weight: 700; cursor: pointer;
  font-family: inherit; box-shadow: 0 4px 16px rgba(var(--color-primary-rgb), 0.22);
}

/* ─── 弹窗 ─── */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;
}
.modal-box {
  background: var(--surface-solid); border-radius: var(--radius-modal); padding: var(--space-6) var(--space-5);
  max-width: 380px; width: 90%; max-height: 85vh; overflow-y: auto;
}
.modal-wide { max-width: 480px; }
.modal-box h3 { font-size: 18px; margin-bottom: 8px; text-align: center; }
.modal-sub { font-size: 13px; color: var(--text-3); margin-bottom: 12px; text-align: center; }
.modal-amount {
  font-size: 28px; font-weight: 800; text-align: center; margin: 10px 0;
  color: var(--color-primary-ink);
}

.modal-qr { text-align: center; margin: 12px 0; }
.qr-img { max-width: 200px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--surface-solid); }
.qr-img-sm { width: 110px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--surface-solid); }
.qr-dual { display: flex; gap: 12px; justify-content: center; }
.qr-tag { font-size: 11px; font-weight: 600; margin-top: 4px; }
.qr-tag.alipay { color: var(--color-info-ink); }
.qr-tag.wechat { color: var(--color-success-ink); }
.qr-hint { font-size: 11px; color: var(--text-3); margin-top: 8px; }
.modal-no-qr { text-align: center; padding: 24px; color: var(--text-3); font-size: 13px; }

.modal-actions { display: flex; gap: 8px; margin-top: 16px; }
.modal-actions .act-btn { flex: 1; padding: 12px; font-size: 14px; }

.modal-close-btn {
  display: block; width: 100%; margin-top: 12px; padding: 10px;
  border: 1px solid var(--border-color); border-radius: 12px;
  background: var(--surface-solid); font-size: 14px; cursor: pointer; font-family: inherit;
}

.resched-err {
  margin-top: 8px; padding: 8px 12px; border-radius: 8px;
  background: var(--color-danger-tint); color: var(--color-danger-ink); font-size: 12px; text-align: center;
}
</style>
