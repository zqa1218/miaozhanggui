<script setup>
import { ref, computed, onMounted, onUnmounted, watch, reactive, inject } from 'vue'
import { storage } from '@/utils/storage'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Histogram } from '@element-plus/icons-vue'
import SvgIcon from '@/components/shared/SvgIcon.vue'
import AppIllustration from '@/components/shared/AppIllustration.vue'

function getToken() { return storage.get('mzg_admin_token', '') }

async function apiFetch(url, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  let response
  try {
    response = await fetch(url, { ...options, headers })
  } catch (e) {
    console.error('[apiFetch] 网络请求失败:', e.message)
    throw e
  }

  if (response.status === 401) {
    storage.remove('mzg_admin_token')
    storage.remove('mzg_admin_mid')
    storage.remove('mzg_admin_shopname')
    if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
      window.location.href = '/admin/login'
    }
    return { success: false, code: 'UNAUTHORIZED', message: '请先登录', data: null }
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const err = new Error((body && body.message) || `请求失败 (${response.status})`)
    err.status = response.status
    throw err
  }
  return body
}
function toMin(t) { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m }
function toTime(m) { const h = Math.floor(m / 60) % 24, mm = m % 60; return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0') }
// ─── 状态标签 ───
const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: '待支付', label: '待支付' },
  { key: '已付定金', label: '已付定金' },
  { key: '未结清', label: '未结清' },
  { key: '改期待批', label: '改期待批', app: 'RESCHEDULE_REQUESTED' },
  { key: '取消待批', label: '取消待批', app: 'CANCEL_REQUESTED' },
  { key: '已完成拍摄', label: '已完成' },
  { key: '已取消', label: '已取消' },
]
const STATUS_MAP = {
  '待支付':     { label: '待支付',   cls: 'badge-pending' },
  '定金待确认': { label: '定金待确认', cls: 'badge-deposit-pending' },
  '已付定金':   { label: '已付定金', cls: 'badge-prepaid' },
  '已确认锁定': { label: '已确认',   cls: 'badge-confirmed' },
  '尾款待确认': { label: '尾款待确认', cls: 'badge-confirmed' },
  '已结清':     { label: '已结清',   cls: 'badge-paid' },
  '未结清':     { label: '未结清',   cls: 'badge-unsettled' },
  '已完成拍摄': { label: '已完成',   cls: 'badge-completed' },
  '已取消':     { label: '已取消',   cls: 'badge-cancelled' },
  '已退款取消': { label: '已退款取消', cls: 'badge-cancelled' },
  '退款审核中': { label: '退款审核中', cls: 'badge-refunding' },
}
// ─── 核心状态 ───
const activeTab = ref('')
const orders = ref([])
const loading = ref(true)
const stats = ref({ active: 0, refunding: 0, completed: 0 })
const page = ref(1)
const total = ref(0)
const pageSize = 20
const dateFilter = ref('')
const searchFilter = ref('')
const showDateOnly = ref(false)
const todayRevenue = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const pendingDepositCount = computed(() => orders.value.filter(o => o.status === '定金待确认').length)

function getMonthRange() {
  const y = calYear.value, m = calMonth.value
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function fmtDateShort(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) return parts[1] + '-' + parts[2]
  return dateStr
}

const mId = computed(() => storage.get('mzg_admin_mid', ''))
// ★ 展开行
const expandedRows = reactive(new Set())
function toggleExpand(orderNo) {
  if (expandedRows.has(orderNo)) expandedRows.delete(orderNo)
  else expandedRows.add(orderNo)
}

// ── 灵感库图片预览 (Lightbox) ──
const lightbox = reactive({ visible: false, images: [], index: 0 })
function openLightbox(images, idx = 0) {
  lightbox.images = images; lightbox.index = idx; lightbox.visible = true
}
function closeLightbox() { lightbox.visible = false; lightbox.images = [] }
function lightboxPrev() { if (lightbox.index > 0) lightbox.index-- }
function lightboxNext() { if (lightbox.index < lightbox.images.length - 1) lightbox.index++ }
function onLightboxKey(e) {
  if (e.key === 'Escape') closeLightbox()
  if (e.key === 'ArrowLeft') lightboxPrev()
  if (e.key === 'ArrowRight') lightboxNext()
}

// 手机端触摸
let touchStartX = 0
function onLightboxTouchStart(e) { touchStartX = e.touches[0].clientX }
function onLightboxTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (dx > 50) lightboxPrev(); else if (dx < -50) lightboxNext()
}

/** 获取订单的所有参考图片（characterImage + referenceImages）扁平数组 */
function getInspirationImages(o) {
  const imgs = []
  const char = o.characterImage
  const refs = o.referenceImages || []
  if (Array.isArray(refs)) imgs.push(...refs.filter(Boolean).map(url => ({ url, label: '动作参考' })))
  if (char) imgs.unshift({ url: char, label: '人设' })
  return imgs
}
// ─── 日历 ───
const now = new Date()
const calYear = ref(now.getFullYear())
const calMonth = ref(now.getMonth() + 1)
const calSelectedDate = ref('')
const calOrderDates = ref(new Set())
const calLoading = ref(false)
function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
const calGridDays = computed(() => {
  const y = calYear.value, m = calMonth.value
  const daysInMonth = new Date(y, m, 0).getDate()
  const firstDow = new Date(y, m - 1, 1).getDay()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayIso = todayStr()
  const days = []
  for (let i = 0; i < firstDow; i++) days.push({ day: '', key: 'e' + i, dateStr: '', isPast: true, isToday: false })
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    const dt = new Date(y, m - 1, d)
    days.push({ day: d, key: ds, dateStr: ds, isPast: dt < today, isToday: ds === todayIso })
  }
  return days
})
function calPrevMonth() {
  if (calMonth.value === 1) { calYear.value--; calMonth.value = 12 } else calMonth.value--
  loadCalendarDates()
}
function calNextMonth() {
  if (calMonth.value === 12) { calYear.value++; calMonth.value = 1 } else calMonth.value++
  loadCalendarDates()
}
async function selectCalDate(dateStr) {
  if (showDateOnly.value) showDateOnly.value = false
  calSelectedDate.value = dateStr
  dateFilter.value = dateStr
  page.value = 1
  await fetchOrders()
  loadTimeline()
}
function jumpToday() {
  const today = todayStr()
  calYear.value = new Date().getFullYear()
  calMonth.value = new Date().getMonth() + 1
  calSelectedDate.value = today
  dateFilter.value = today
  page.value = 1
  fetchOrders()
  loadTimeline()
}
function showCurrentMonth() {
  const now = new Date()
  calYear.value = now.getFullYear()
  calMonth.value = now.getMonth() + 1
  // 默认选中"今天"而不是当月 1 号：商家打开后台要看的是今天的排期，
  // 而 1 号通常一单都没有，排期看板会呈现为一条没有任何内容的空条。
  const today = todayStr()
  dateFilter.value = today
  calSelectedDate.value = today
  page.value = 1
  fetchOrders()
  loadTimeline()
}
async function loadCalendarDates() {
  calLoading.value = true
  try {
    // 取整月范围。原先传的是 `date=当月1号`，只返回 1 号当天的订单，
    // 日历上"有单"的小圆点因此常年为空，商家没法从日历找到有排期的日子。
    const { start: startDate, end: endDate } = getMonthRange()
    const res = await apiFetch(`/api/orders?mId=${mId.value}&page=1&pageSize=100&startDate=${startDate}&endDate=${endDate}`)
    if ((res.success || res.code === 0) && res.data?.list) {
      const dates = new Set()
      res.data.list.forEach(o => { const d = o.date || (o.created_at ? o.created_at.slice(0, 10) : ''); if (d) dates.add(d) })
      calOrderDates.value = dates
    }
  } catch (e) {
    console.error('[loadCalendarDates] 加载日历失败:', e.message)
  }
  calLoading.value = false
}
// ★ 排序 + 审批类前端过滤 + 按日期分组
function getOrderDate(o) {
  return o.bookingDate || o.booking_date || o.date || (o.created_at ? o.created_at.slice(0, 10) : '')
}
const groupedOrders = computed(() => {
  let list = [...orders.value]
  // 审批类 tab 按 application_status 过滤
  if (activeTab.value === '改期待批') {
    list = list.filter(o => (o.applicationStatus || o.application_status) === 'RESCHEDULE_REQUESTED')
  } else if (activeTab.value === '取消待批') {
    list = list.filter(o => (o.applicationStatus || o.application_status) === 'CANCEL_REQUESTED')
  }
  // 按日期+时间排序
  list.sort((a, b) => {
    const da = getOrderDate(a), db = getOrderDate(b)
    if (da !== db) return da.localeCompare(db)
    const ta = a.bookingStartTime || a.booking_start_time || ''
    const tb = b.bookingStartTime || b.booking_start_time || ''
    if (ta && tb) return ta.localeCompare(tb)
    if (ta) return -1
    if (tb) return 1
    return (a.created_at || '').localeCompare(b.created_at || '')
  })
  // 按日期分组
  const groups = []
  let currentDate = ''
  for (const o of list) {
    const d = getOrderDate(o)
    if (d !== currentDate) {
      currentDate = d
      groups.push({ date: d, orders: [o] })
    } else {
      groups[groups.length - 1].orders.push(o)
    }
  }
  return groups
})
// ─── API ───
let fetchSeq = 0
async function fetchOrders() {
  const seq = ++fetchSeq
  loading.value = true
  try {

    const params = new URLSearchParams({ page: page.value, pageSize, mId: mId.value })
    if (activeTab.value) params.set('status', activeTab.value)
    // "仅显示当日订单"开关：强制只显示今天
    if (showDateOnly.value) {
      params.set('date', todayStr())
    } else if (activeTab.value === '' || activeTab.value === '待支付') {
      // "全部"和"待支付"显示当月所有排单
      const month = getMonthRange()
      params.set('startDate', month.start)
      params.set('endDate', month.end)
    } else if (dateFilter.value) {
      params.set('date', dateFilter.value)
    }
    if (searchFilter.value) params.set('search', searchFilter.value)
    const fullUrl = `/api/orders?${params}`
    const res = await apiFetch(fullUrl)
    // 防止旧请求覆盖新数据
    if (seq !== fetchSeq) return
    if (res.success || res.code === 0) {
      const data = res.data || {}
      orders.value = data.list || []
      total.value = data.total || 0
      stats.value = data.stats || { active: 0, refunding: 0, completed: 0 }
    }
  } catch (e) {
    if (seq !== fetchSeq) return
    console.error('[fetchOrders] 加载订单失败:', e.message)
  } finally {
    if (seq === fetchSeq) loading.value = false
  }
}
async function fetchRevenue() {
  try {
    const res = await apiFetch(`/api/order-stats?mId=${mId.value}`)
    if (res.success || res.code === 0) todayRevenue.value = (res.data && res.data.revenue) || 0
  } catch (e) {
    console.error('[fetchRevenue] 加载营收失败:', e.message)
  }
}
function toggleTodayOnly(val) {
  page.value = 1
  if (val) {
    // 切换 ON：强制跳转到今天
    const today = todayStr()
    calYear.value = new Date().getFullYear()
    calMonth.value = new Date().getMonth() + 1
    calSelectedDate.value = today
    dateFilter.value = today
  } else {
    // 切换 OFF：恢复当月视图
    showCurrentMonth()
    return  // showCurrentMonth 内部已调用 fetchOrders
  }
  fetchOrders()
}
function switchTab(key) {
  activeTab.value = key
  page.value = 1
  // 审批类 tab：拉全量，前端过滤
  if (key === '改期待批' || key === '取消待批') {
    dateFilter.value = ''
    calSelectedDate.value = ''
    const saved = activeTab.value
    activeTab.value = ''
    fetchOrders().then(() => { activeTab.value = saved })
  } else if (key === '未结清') {
    // 跨日期拉取所有未结清订单
    dateFilter.value = ''
    calSelectedDate.value = ''
    fetchOrders()
  } else if (key === '已取消') {
    // 使用后端 CANCELLED_ANY 过滤器（覆盖新旧两种取消路径）
    dateFilter.value = ''
    calSelectedDate.value = ''
    const saved = activeTab.value
    activeTab.value = 'CANCELLED_ANY'
    fetchOrders().then(() => { activeTab.value = saved })
  } else {
    fetchOrders()
  }
}
function goPage(p) { page.value = p; fetchOrders() }
function doSearch() { page.value = 1; fetchOrders() }
// ─── ★ 24h 排期时间轴 ───
const timelineSegments = ref([])
const timelineRange = ref({ start: '09:00', end: '21:00' })
const timelineError = ref('')
// 当天是否真的有任何占用（预约或休息）。全空时时间条只剩一个"空闲"块，
// 需要额外一句话说明"不是坏了，是这天没人约"。
const timelineBusy = computed(() => timelineSegments.value.some(s => s.type !== 'free'))

/** 小时刻度。跨度大时自动降为 2h/3h 一档，避免手机上标签互相压住。 */
const timelineTicks = computed(() => {
  const s = toMin(timelineRange.value.start)
  const e = toMin(timelineRange.value.end)
  const total = e - s
  if (total <= 0) return []
  const step = total > 900 ? 180 : total > 600 ? 120 : 60
  const ticks = []
  for (let m = Math.ceil(s / step) * step; m <= e; m += step) {
    ticks.push({ label: toTime(m), left: (m - s) / total * 100 })
  }
  return ticks
})

async function loadTimeline() {
  if (!calSelectedDate.value || !mId.value) { timelineSegments.value = []; return }
  const date = calSelectedDate.value
  // 注意：这里不清空 timelineSegments。30 秒轮询每次都清空会让面板整个
  // 卸载再挂载，商家看到时间条不停闪烁。新数据到了再整体替换。
  try {
    const res = await apiFetch(`/api/booked-times-v2?mId=${mId.value}&date=${date}`)
    if (date !== calSelectedDate.value) return          // 已切到别的日期，丢弃过期响应
    if (res.success === false && res.data == null) throw new Error(res.message || '加载排期失败')
    const data = (res.data || res)
    timelineRange.value = { start: data.baseStartTime || '09:00', end: data.baseEndTime || '21:00' }
    buildTimelineSegments(timelineRange.value.start, timelineRange.value.end, data.restRanges || [], data.bookedRanges || [])
    timelineError.value = ''
  } catch (e) {
    if (date !== calSelectedDate.value) return
    timelineSegments.value = []
    timelineError.value = e.message || '加载排期失败'
    console.error('[loadTimeline] 加载排期失败:', e.message)
  }
}
function buildTimelineSegments(baseStart, baseEnd, rests, booked) {
  const baseS = toMin(baseStart)
  const baseE = toMin(baseEnd)
  const totalMin = baseE - baseS
  if (totalMin <= 0) { timelineSegments.value = []; return }

  // 区间裁剪到营业时间；起止倒挂或完全落在营业时间外的直接丢弃
  const clip = (r) => {
    const s = Math.max(toMin(r.start), baseS)
    const e = Math.min(toMin(r.end), baseE)
    return e > s ? { s, e } : null
  }
  const freeSeg = (from, to) => ({
    type: 'free', w: (to - from) / totalMin * 100,
    label: '空闲', tooltip: toTime(from) + '-' + toTime(to) + ' 空闲',
  })

  const items = []
  // 固定休息时段（商家设置）
  for (const r of rests) {
    const c = clip(r)
    if (c) items.push({ s: c.s, e: c.e, type: 'rest', label: '休息 ' + toTime(c.s) + '-' + toTime(c.e) })
  }
  // 已预约时段：按 restMinutes 拆分为拍摄段 + 休息段
  for (const b of booked) {
    const c = clip(b)
    if (!c) continue
    const restMin = b.restMinutes || 0
    if (restMin > 0 && c.e - c.s > restMin) {
      const shootEnd = c.e - restMin
      items.push({ s: c.s, e: shootEnd, type: b.lockType || 'pre_lock', label: toTime(c.s) + '-' + toTime(shootEnd), orderNo: b.orderNo })
      // 拍摄后的自动休息段
      items.push({ s: shootEnd, e: c.e, type: 'rest_tail', label: '休息 ' + restMin + 'min', orderNo: b.orderNo })
    } else {
      items.push({ s: c.s, e: c.e, type: b.lockType || 'pre_lock', label: toTime(c.s) + '-' + toTime(c.e), orderNo: b.orderNo })
    }
  }
  // 游标法：重叠区间（商家级看板会同时包含多个项目的占位）自然合并成并集，
  // 被完全覆盖的段直接从结果里消失。
  items.sort((a, b) => a.s - b.s)
  const result = []
  let cursor = baseS
  for (const it of items) {
    if (it.e <= cursor) continue
    const segStart = Math.max(it.s, cursor)
    if (segStart > cursor) result.push(freeSeg(cursor, segStart))
    result.push({
      type: it.type, w: (it.e - segStart) / totalMin * 100, label: it.label,
      tooltip: toTime(segStart) + '-' + toTime(it.e) + ' ' + it.label + (it.orderNo ? ' (' + it.orderNo + ')' : ''),
    })
    cursor = it.e
  }
  if (cursor < baseE) result.push(freeSeg(cursor, baseE))
  timelineSegments.value = result
}
watch(calSelectedDate, () => { loadTimeline() })
// ─── 操作 ───
async function updateStatus(orderNo, status) {
  const labels = { '已确认锁定': '确认接单并锁死时段', '已取消': '取消订单', '已完成拍摄': '标记完成', '已付定金': '确认收到定金' }
  if (!confirm(`确定「${labels[status] || status}」订单 ${orderNo}？`)) return
  await apiFetch('/api/update-status', {
    method: 'POST',
    body: JSON.stringify({ orderNo, status }),
  })
  if (status === '已确认锁定' || status === '已付定金') {
    await apiFetch('/api/order/confirm-lock', {
      method: 'POST',
      body: JSON.stringify({ orderNo }),
    }).catch(() => {})
  }
  fetchOrders(); loadCalendarDates(); loadTimeline()
}
async function archiveOrder(o, type) {
  const labels = { '已完成拍摄': '完成拍摄', '已取消': '取消订单', '已退款取消': '退款取消' }
  if (!confirm(`确定${labels[type] || '归档'}「${o.orderNo}」？${type === '已取消' ? '时段将释放' : ''}`)) return
  const res = await apiFetch('/api/archive-order', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo, type }),
  })
  if (res.success || res.code === 0) {
    if (type === '已取消' || type === '已退款取消') ElMessage.success('操作成功，已自动释放对应时间轴排期')
    fetchOrders(); loadCalendarDates(); loadTimeline()
  } else ElMessage.error(res.message || '归档失败')
}
async function approveRefund(o) {
  if (!confirm('确定同意退款？将释放该订单占用的时段。')) return
  const res = await apiFetch('/api/refund/approve', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) { fetchOrders(); loadCalendarDates(); loadTimeline() }
  else ElMessage.error(res.message || '操作失败')
}
async function rejectRefund(o) {
  let reason = prompt('拒绝原因（选填）:')
  if (reason === null) return
  await apiFetch('/api/refund/reject', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo, reason: reason || '' }),
  })
  fetchOrders(); loadCalendarDates()
}
// ─── ★ 新增：状态机审批操作 ───
async function adminConfirmDeposit(o) {
  if (!confirm(`确认收到「${o.studioTitle || o.orderNo}」的定金 ¥${o.depositAmount || 0}？`)) return
  const res = await apiFetch('/api/order/confirm-deposit', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) { fetchOrders(); loadCalendarDates(); loadTimeline() }
  else ElMessage.error(res.message || '操作失败')
}
async function adminConfirmCompleted(o) {
  if (!confirm(`确认「${o.studioTitle || o.orderNo}」已结清尾款？`)) return
  const res = await apiFetch('/api/order/confirm-completed', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) { fetchOrders(); loadCalendarDates(); loadTimeline() }
  else ElMessage.error(res.message || '操作失败')
}

async function markFulfilledApi(o) {
  if (!confirm(`确定「${o.studioTitle || o.orderNo}」服务已完成？\n系统将根据尾款状态自动分流为"已完成"或"未结清"。`)) return
  const res = await apiFetch('/api/order/mark-fulfilled', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) { fetchOrders(); loadCalendarDates(); loadTimeline() }
  else ElMessage.error(res.message || '操作失败')
}

async function adminApproveReschedule(o) {
  const newTime = o.requestedNewTime || o.requested_new_time || ''
  if (!confirm(`同意改期申请？\n新时间：${newTime}\n系统将释放原时段并锁定新时段。`)) return
  const res = await apiFetch('/api/order/approve-reschedule', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) { fetchOrders(); loadCalendarDates(); loadTimeline() }
  else ElMessage.error(res.message || '操作失败')
}

async function adminRejectReschedule(o) {
  if (!confirm('确定拒绝改期申请？订单将保持原时间不变。')) return
  const res = await apiFetch('/api/order/reject-reschedule', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) { fetchOrders(); loadCalendarDates(); loadTimeline() }
  else ElMessage.error(res.message || '操作失败')
}

async function adminApproveCancel(o) {
  if (!confirm(`确定同意取消「${o.studioTitle || o.orderNo}」？\n将退款并释放占用的时段。`)) return
  const res = await apiFetch('/api/order/approve-cancel', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) { fetchOrders(); loadCalendarDates(); loadTimeline() }
  else ElMessage.error(res.message || '操作失败')
}

async function adminRejectCancel(o) {
  if (!confirm('确定拒绝取消申请？订单保持正常。')) return
  const res = await apiFetch('/api/order/reject-cancel', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) { fetchOrders(); loadCalendarDates(); loadTimeline() }
  else ElMessage.error(res.message || '操作失败')
}

async function exportOrders() {
  const token = getToken()
  if (!token) { window.location.href = '/admin/login'; return }
  try {
    const params = new URLSearchParams({ mId: mId.value, pageSize: 500 })
    if (dateFilter.value) params.set('date', dateFilter.value)
    const res = await fetch(`/api/order/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.download = `商家订单报表_${today}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch { ElMessage.error('导出失败') }
}

const importFileInput = ref(null)
const importing = ref(false)

function triggerImport() { importFileInput.value?.click() }

// ─── ★ Excel 快速导入（仅固定档位项目）───
const showImportDialog    = ref(false)
const importStudios       = ref([])        // 过滤后只剩 timeMode === 'fixed_slot'
const importStudioId      = ref(null)
const importDate          = ref('')
const importErrors        = ref([])
const importErrorTitle    = ref('')
const templateDownloading = ref(false)

function clearImportErrors() { importErrors.value = []; importErrorTitle.value = '' }
function openImportDialog() { clearImportErrors(); showImportDialog.value = true }

async function loadImportStudios() {
  clearImportErrors()
  try {
    const res = await apiFetch(`/api/studios?mId=${mId.value}`)
    const list = Array.isArray(res.data) ? res.data : (res.data?.list || [])
    // 时间轴模式的项目不支持 Excel 快速导入，直接不列出来
    importStudios.value = list.filter(s => s.timeMode === 'fixed_slot')
    if (importStudios.value.length === 1) importStudioId.value = importStudios.value[0].id
  } catch {
    importStudios.value = []
  }
}

async function downloadSlotTemplate() {
  const token = getToken()
  if (!token) { window.location.href = '/admin/login'; return }
  templateDownloading.value = true
  try {
    const params = new URLSearchParams({
      mId: mId.value, studioId: importStudioId.value, date: importDate.value,
    })
    const res = await fetch(`/api/order/import-template?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error((body && body.message) || '模板下载失败')
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `档位导入模板_${importDate.value}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    ElMessage.error(e.message || '模板下载失败')
  } finally {
    templateDownloading.value = false
  }
}

async function handleImportFile(e) {
  const file = e.target.files[0]
  if (!file) return
  if (!/\.xlsx?$/i.test(file.name)) { ElMessage.warning('仅支持 .xlsx 或 .xls 格式'); e.target.value = ''; return }
  if (!importStudioId.value || !importDate.value) {
    ElMessage.warning('请先选择项目和日期'); e.target.value = ''; return
  }
  if (!confirm(`确认把「${file.name}」导入到所选项目 ${importDate.value} 的档位？`)) {
    e.target.value = ''; return
  }
  importing.value = true
  clearImportErrors()
  try {
    const token = getToken()
    const fd = new FormData()
    // 文本字段必须排在 file 之前，否则 multer 解析 multipart 时 req.body 还是空的
    fd.append('studioId', String(importStudioId.value))
    fd.append('date', importDate.value)
    fd.append('file', file)
    const res = await fetch('/api/order/import', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
    })
    const body = await res.json().catch(() => null)
    if (res.ok && body && (body.success || body.code === 0)) {
      ElMessage.success(body.message || '导入成功')
      showImportDialog.value = false
      fetchOrders(); loadCalendarDates(); loadTimeline(); fetchRevenue()
    } else {
      // 结构化逐行错误：弹窗内列表展示，弹窗不关闭，可直接改文件重传
      importErrorTitle.value = (body && body.message) || '导入失败'
      importErrors.value = Array.isArray(body && body.data) ? body.data : []
      if (importErrors.value.length === 0) ElMessage.error(importErrorTitle.value)
    }
  } catch {
    ElMessage.error('网络错误，导入失败')
  }
  importing.value = false
  e.target.value = ''
}

// 判断是否需要显示新状态机按钮
function hasApplication(o, type) {
  const app = o.applicationStatus || o.application_status || ''
  return app === type
}

// 判断订单是否已取消（可恢复）
function isCancelledOrder(o) {
  return o.status === '已取消' || o.status === '已退款取消' ||
    (o.serviceStatus || o.service_status) === 'CANCELLED' ||
    (o.paymentStatus || o.payment_status) === 'REFUNDED'
}

async function restoreOrder(o) {
  if (!confirm(`确认恢复订单「${o.orderNo}」？\n系统将重新锁定原时间段 ${o.bookingStartTime || ''}—${o.bookingEndTime || ''}。\n如果该时段已被他人预约，恢复将失败。`)) return

  const res = await apiFetch('/api/order/restore', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) {
    fetchOrders(); loadCalendarDates(); loadTimeline()
  } else {
    ElMessage.error(res.message || '恢复失败')
  }
}

async function confirmSettled(o) {
  if (!confirm(`确认「${o.studioTitle || o.orderNo}」已收到尾款并结清？\n订单将从「未结清」变为「已完成」。`)) return

  const res = await apiFetch('/api/order/confirm-settled', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) {
    fetchOrders(); loadCalendarDates(); loadTimeline()
  } else {
    ElMessage.error(res.message || '结清失败')
  }
}

async function clearCompletedOrders() {
  if (!confirm('确定要清除所有已完成订单吗？\n\n此操作不可撤销，将永久删除当前商家的所有已完成订单。')) return
  if (!confirm('再次确认：此操作不可恢复！\n\n确定要继续吗？')) return
  const res = await apiFetch('/api/order/clear-completed', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (res.success || res.code === 0) {
    ElMessage.success(res.message || '清除完成')
    fetchOrders(); loadCalendarDates(); loadTimeline()
  } else {
    ElMessage.error(res.message || '清除失败')
  }
}

async function deleteOrder(o) {
  if (!confirm(`确定永久删除订单「${o.orderNo}」？\n此操作不可撤销，订单数据将彻底清除。`)) return

  const res = await apiFetch('/api/order/delete', {
    method: 'POST',
    body: JSON.stringify({ orderNo: o.orderNo }),
  })
  if (res.success || res.code === 0) {
    fetchOrders(); loadCalendarDates(); loadTimeline()
  } else {
    ElMessage.success('订单已永久删除，已自动释放对应时间轴排期')
  }
}

// ─── 格式化 ───
function fmtBookingTime(o) {
  const start = o.bookingStartTime || o.booking_start_time
  const end = o.bookingEndTime || o.booking_end_time
  if (start && end) return (start.slice(0, 5)) + ' — ' + (end.slice(0, 5))
  const slots = o.slots || o.timeSlots
  if (slots && slots.length) return slots.map(s => ((s.start_time || s.start || '').slice(0, 5)) + '-' + ((s.end_time || s.end || '').slice(0, 5))).join(', ')
  return '—'
}
function statusBadge(s) { return STATUS_MAP[s] || { label: s, cls: 'badge-pending' } }
function fmtPrice(n) { return Number(n || 0).toFixed(2) }
function lockLabel(o) {
  if (o.lockStatus === 'hard_lock' || o.lock_status === 'hard_lock') return 'hard'
  if (o.lockStatus === 'pre_lock' || o.lock_status === 'pre_lock') return 'pre'
  return ''
}

const ACTIVE_STATUSES = ['待支付', '定金待确认', '已付定金', '已确认锁定', '尾款待确认', '已结清', '未结清']
function isActiveStatus(s) { return ACTIVE_STATUSES.includes(s) }

// ─── 生命周期 ───
let timer
onMounted(() => {
  showCurrentMonth()
  fetchRevenue()
  loadCalendarDates()
  timer = setInterval(async () => { await fetchOrders(); loadCalendarDates(); loadTimeline() }, 30000)
})
onUnmounted(() => clearInterval(timer))

// ── 监听刷新总线 (管理员手动刷新) ──
const refreshBus = inject('refreshBus', null)
watch(() => refreshBus?.tick, async (newTick) => {
  if (!newTick || newTick <= 0) return
  try {
    await fetchOrders()
    await Promise.all([loadCalendarDates(), loadTimeline()])
  } catch { /* 静默 */ }
})
</script>

<template>
  <div class="order-mgmt fade-in-up">

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card"><div class="num" style="color: var(--color-primary-ink);">¥{{ todayRevenue }}</div><div class="lbl">今日营收</div></div>
      <div class="stat-card"><div class="num" style="color:var(--color-info-ink);">{{ stats.active }}</div><div class="lbl">进行中</div></div>
      <div class="stat-card"><div class="num" style="color: var(--color-warning-ink);">{{ stats.refunding }}</div><div class="lbl">退款审核</div></div>
      <div class="stat-card"><div class="num" style="color: var(--color-success-ink);">{{ stats.completed }}</div><div class="lbl">已归档</div></div>
    </div>

    <!-- 日历 -->
    <div class="cal-view">
      <div class="cal-nav">
        <button class="cal-nav-btn" aria-label="上个月" @click="calPrevMonth"><el-icon><ArrowLeft /></el-icon></button>
        <span>{{ calYear }}年 {{ calMonth }}月</span>
        <button class="cal-nav-btn" aria-label="下个月" @click="calNextMonth"><el-icon><ArrowRight /></el-icon></button>
        <button class="btn-today" @click="jumpToday">今天</button>
      </div>
      <div class="cal-wdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
      <div class="cal-grid">
        <div v-for="d in calGridDays" :key="d.key"
             :class="['cal-cell', { today: d.isToday, selected: d.dateStr === calSelectedDate, past: d.isPast, 'has-order': calOrderDates.has(d.dateStr) }]"
             @click="!d.isPast && selectCalDate(d.dateStr)">
          {{ d.day || '' }}
        </div>
      </div>
      <div v-if="calSelectedDate" class="cal-date-label">当前筛选: {{ calSelectedDate }}</div>
    </div>

    <!-- ★ 24h横向排期状态条 ★ -->
    <div class="timeline-wrap" v-if="calSelectedDate">
      <h4 class="tl-title">
        <el-icon><Histogram /></el-icon>
        <span>{{ calSelectedDate }} 排期看板</span>
        <span class="tl-range">营业 {{ timelineRange.start }}–{{ timelineRange.end }}</span>
      </h4>

      <div v-if="timelineError" class="tl-error">
        <SvgIcon name="icon-circle-exclamation" :size="16" />
        <span>排期加载失败：{{ timelineError }}</span>
        <el-button size="small" @click="loadTimeline">重试</el-button>
      </div>

      <template v-else>
        <!-- 小时刻度：没有刻度的时间条读不出"几点"，等于一条色带 -->
        <div class="tl-axis">
          <span v-for="t in timelineTicks" :key="t.label"
                class="tl-axis-label" :style="{ left: t.left + '%' }">{{ t.label }}</span>
        </div>

        <div class="tl-bar">
          <div v-for="(seg, i) in timelineSegments" :key="i"
               :class="['tl-seg', seg.type]"
               :style="{ width: seg.w + '%' }"
               :title="seg.tooltip">
            <span v-if="seg.w > 9" class="tl-seg-label">{{ seg.label }}</span>
          </div>
        </div>

        <p v-if="timelineSegments.length === 0" class="tl-hint">
          {{ timelineRange.start }}–{{ timelineRange.end }} 之外没有可排期时段
        </p>
        <p v-else-if="!timelineBusy" class="tl-hint">
          当天暂无预约，全天可约
        </p>
      </template>

      <div class="tl-legend">
        <span><span class="ldot free"></span>空闲</span>
        <span><span class="ldot rest"></span>休息</span>
        <span><span class="ldot rest_tail"></span>休息(自动)</span>
        <span><span class="ldot pre_lock"></span>预锁</span>
        <span><span class="ldot hard_lock"></span>硬锁</span>
      </div>

      <!-- 操作行：从图例里拆出来，图例是窄条，三个按钮挤在移动端会糊成一团 -->
      <div class="tl-actions">
        <el-button size="small" @click="exportOrders">
          <SvgIcon name="icon-export" :size="16" />导出当前订单
        </el-button>
        <el-button size="small" @click="openImportDialog">
          <SvgIcon name="icon-import" :size="16" />Excel 快速导入
        </el-button>
      </div>
      <input ref="importFileInput" type="file" accept=".xlsx,.xls" style="display:none" @change="handleImportFile" />
    </div>

    <!-- ★ Excel 快速导入弹窗（仅固定档位项目） -->
    <el-dialog v-model="showImportDialog" title="Excel 快速导入" width="640px" @open="loadImportStudios">
      <div class="imp-row">
        <span class="imp-label">项目</span>
        <el-select v-model="importStudioId" placeholder="仅固定档位模式的项目可选" style="flex:1" @change="clearImportErrors">
          <el-option v-for="s in importStudios" :key="s.id" :label="s.title" :value="s.id" />
        </el-select>
      </div>
      <div class="imp-row">
        <span class="imp-label">日期</span>
        <el-date-picker v-model="importDate" type="date" value-format="YYYY-MM-DD"
                        placeholder="选择档位日期" style="flex:1" @change="clearImportErrors" />
      </div>

      <p v-if="importStudios.length === 0" class="imp-empty">
        当前没有固定档位模式的项目。请先在「项目 → 编辑 → 预约时间模式」把项目切换为固定档位模式。
      </p>
      <p v-else class="imp-hint">
        ① 先选项目与日期 → ② 下载空白模板（第一列是当天还空着的档位，已标黄）→
        ③ 填写 角色名称 / 顾客cn / 备注要求 / 订单总金额 / 定金 → ④ 上传导入。<br />
        <strong>不用把模板填满</strong>：只填要排的那几行，其余留空的档位会自动跳过。<br />
        导入后自动生成订单号，订单状态为「已付定金」，立即出现在时间轴与订单页；
        金额计入<strong>所选日期</strong>当天的营收（不是导入当天）。
      </p>

      <div class="imp-actions">
        <el-button :disabled="!importStudioId || !importDate" :loading="templateDownloading" @click="downloadSlotTemplate">
          <SvgIcon name="icon-download-template" :size="16" />下载空白模板
        </el-button>
        <el-button type="primary" :disabled="!importStudioId || !importDate" :loading="importing" @click="triggerImport">
          <SvgIcon name="icon-import" :size="16" />选择文件并导入
        </el-button>
      </div>

      <div v-if="importErrors.length" class="imp-errors">
        <div class="imp-errors-title">{{ importErrorTitle }}</div>
        <el-table :data="importErrors" size="small" max-height="280" border>
          <el-table-column prop="row" label="行号" width="72" />
          <el-table-column label="错误内容">
            <template #default="{ row }">{{ (row.errors || []).join('；') }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- Tab -->
    <div class="tabs">
      <div v-for="t in STATUS_TABS" :key="t.key"
           :class="['tab-item', { active: activeTab === t.key }]"
           @click="switchTab(t.key)">{{ t.label }}</div>
    </div>

    <!-- 搜索 -->
    <div class="search-row">
      <el-switch v-model="showDateOnly" active-text="仅显示当日订单" @change="toggleTodayOnly" />
      <input v-model="searchFilter" placeholder="搜索角色名/联系方式" class="input-field" @keyup.enter="doSearch" />
      <el-button size="small" @click="doSearch">查询</el-button>
      <el-button size="small" @click="dateFilter='';calSelectedDate='';searchFilter='';showDateOnly=false;page=1;showCurrentMonth()">清除</el-button>
      <span v-if="pendingDepositCount > 0" class="pending-alert-badge">有新定金待确认 ×{{ pendingDepositCount }}</span>
      <el-button size="small" type="danger" plain v-if="activeTab==='已完成拍摄'" @click="clearCompletedOrders">清除已完成</el-button>
    </div>

    <div v-if="loading" class="empty">加载中...</div>
    <div v-else-if="orders.length===0" class="empty">
      <AppIllustration name="empty-no-orders-admin" :width="160" />
      <p>暂无订单</p>
    </div>

    <!-- ★ 桌面端表格 ★ -->
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:100px;">日期</th>
            <th style="width:140px;">时间段</th>
            <th>项目 / 角色</th>
            <th style="width:110px;">金额</th>
            <th style="width:80px;">状态</th>
            <th style="width:190px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groupedOrders" :key="group.date">
            <!-- 日期分组标题行 -->
            <tr class="date-group-row">
              <td colspan="6">
                <div class="date-group-header">
                  <span class="date-group-label">{{ group.date }}</span>
                  <span class="date-group-count">{{ group.orders.length }} 单</span>
                </div>
              </td>
            </tr>
            <template v-for="o in group.orders" :key="o.id || o.orderNo">
              <tr :class="'row-' + (o.status || '')" class="clickable-row" @click="toggleExpand(o.orderNo)">
                <td>
                  <span class="cell-date">{{ getOrderDate(o) }}</span>
                </td>
                <td>
                  <span class="time-date-prefix">{{ fmtDateShort(getOrderDate(o)) }}</span>
                  <div class="time-block">{{ fmtBookingTime(o) }}</div>
                  <SvgIcon v-if="lockLabel(o)" :class="'lock-dot ' + lockLabel(o)"
                       :name="lockLabel(o)==='pre' ? 'icon-lock-pre' : 'icon-lock-hard'"
                       :size="12" :label="lockLabel(o)==='pre' ? '预锁' : '硬锁'" />
                </td>
                <td>
                  <div class="cell-title">{{ o.studioTitle || o.studio_name || '—' }}</div>
                  <div v-if="o.roleName || o.role_name" class="cell-role">{{ o.roleName || o.role_name }}</div>
                </td>
                <td>
                  <div class="cell-price">¥{{ fmtPrice(o.totalPrice || o.total_amount || 0) }}</div>
                  <div class="cell-deposit">定金 ¥{{ fmtPrice(o.depositAmount || o.deposit_amount || 0) }}</div>
                </td>
                <td>
                  <span class="badge-cell" :class="statusBadge(o.status).cls">{{ statusBadge(o.status).label }}</span>
                </td>
                <td @click.stop>
                  <div class="btn-group">
                    <!-- ★ 待支付 → 确认收到定金 -->
                    <el-button size="small" type="primary" v-if="o.status==='待支付' || o.status==='定金待确认'" @click="adminConfirmDeposit(o)" :type="o.status==='定金待确认' ? 'warning' : 'primary'">{{ o.status==='定金待确认' ? '核对流水并确认定金' : '确认收到定金' }}</el-button>
                    <!-- ★ 已付定金 / 已确认 → 确定服务完成（隐藏取消按钮） -->
                    <el-button size="small" type="success" v-if="o.status==='已付定金' || o.status==='已确认锁定'" @click="markFulfilledApi(o)">确定服务完成</el-button>
                    <!-- ★ 尾款待确认 → 确认结清 -->
                    <el-button size="small" type="primary" v-if="o.status==='尾款待确认'" @click="updateStatus(o.orderNo,'已结清')">确认结清</el-button>
                    <!-- ★ 已结清 → 完成拍摄 -->
                    <el-button size="small" type="success" v-if="o.status==='已结清'" @click="archiveOrder(o,'已完成拍摄')">完成拍摄</el-button>
                    <!-- ★ 未结清 → 确认结清（高亮） -->
                    <el-button size="small" type="warning" v-if="o.status==='未结清'" @click="confirmSettled(o)">确认结清</el-button>
                    <!-- ★ 退款审核 -->
                    <el-button size="small" type="success" v-if="o.status==='退款审核中'" @click="approveRefund(o)">同意退款</el-button>
                    <el-button size="small" type="warning" v-if="o.status==='退款审核中'" @click="rejectRefund(o)">拒绝</el-button>
                    <!-- ★ 取消：仅待支付/尾款待确认/已结清/未付款状态可见，已确认状态隐藏 -->
                    <el-button size="small" type="danger" plain v-if="(o.status==='待支付' || o.status==='定金待确认' || o.status==='尾款待确认' || o.status==='已结清') && o.status!=='退款审核中'" @click="archiveOrder(o,'已取消')">取消</el-button>

                    <!-- ★ 已取消：恢复 + 删除 -->
                    <el-button size="small" type="warning" plain v-if="isCancelledOrder(o)" @click="restoreOrder(o)">恢复</el-button>
                    <el-button size="small" type="danger" plain v-if="isCancelledOrder(o)" @click="deleteOrder(o)">删除</el-button>

                    <!-- ★ 新状态机：改期审批 -->
                    <template v-if="hasApplication(o, 'RESCHEDULE_REQUESTED')">
                      <el-button size="small" type="success" @click="adminApproveReschedule(o)">同意改期</el-button>
                      <el-button size="small" type="warning" @click="adminRejectReschedule(o)">拒绝</el-button>
                    </template>

                    <!-- ★ 新状态机：取消审批 -->
                    <template v-if="hasApplication(o, 'CANCEL_REQUESTED')">
                      <el-button size="small" type="danger" @click="adminApproveCancel(o)">同意取消</el-button>
                      <el-button size="small" type="warning" @click="adminRejectCancel(o)">拒绝</el-button>
                    </template>
                  </div>
                </td>
              </tr>
              <!-- ★ 展开详情行 -->
              <tr v-if="expandedRows.has(o.orderNo)" class="expand-row">
                <td colspan="6">
                  <div class="expand-content">
                    <div class="expand-grid">
                      <div><strong>角色:</strong> {{ o.roleName || o.role_name || '—' }}</div>
                      <div v-if="o.modelExperience || o.model_experience"><strong>经验:</strong> {{ o.modelExperience || o.model_experience }}</div>
                      <div v-if="o.styleName || o.style_name"><strong>样式:</strong> {{ o.styleName || o.style_name }}</div>
                      <div v-if="o.optType || o.opt_type"><strong>类型:</strong> {{ (o.optType || o.opt_type) === 'single' ? '单张' : '套餐' }}</div>
                      <div v-if="o.addonTotal > 0"><strong>附加:</strong> +¥{{ o.addonTotal }}</div>
                      <div v-if="o.addonTotal > 0 && (o.selectedAddonIds || []).length > 0"><strong>附加项数:</strong> {{ (o.selectedAddonIds || []).length }} 项</div>
                      <div v-if="(o.applicationStatus||o.application_status) && (o.applicationStatus||o.application_status) !== 'NONE'">
                        <strong>申请:</strong> {{ o.applicationStatus === 'RESCHEDULE_REQUESTED' ? '改期待批' : '取消待批' }}
                      </div>
                      <div v-if="o.requestedNewTime || o.requested_new_time"><strong>改期至:</strong> {{ o.requestedNewTime || o.requested_new_time }}</div>
                      <div><strong>联系方式:</strong> {{ o.contactNote || o.contact_note || o.contact || '—' }}</div>
                      <div><strong>设备码:</strong> <code>{{ o.userDeviceId || o.user_device_id || '—' }}</code></div>
                      <div v-if="o.refundText || o.refund_text"><strong>退款账号:</strong> {{ o.refundText || o.refund_text }}</div>
                      <div v-if="o.refundImgUrl || o.refund_img_url"><strong>收款码:</strong> <img :src="o.refundImgUrl || o.refund_img_url" class="refund-thumb" /></div>
                      <div v-if="o.rejectReason || o.reject_reason"><strong>拒绝原因:</strong> {{ o.rejectReason || o.reject_reason }}</div>
                      <div><strong>订单号:</strong> {{ o.orderNo }}</div>
                      <div><strong>创建:</strong> {{ o.createdAt || o.created_at }}</div>
                    </div>
                    <!-- ★ 客户拍摄灵感储备 -->
                    <div v-if="getInspirationImages(o).length > 0" class="inspiration-library">
                      <div class="inspiration-title">客户拍摄灵感储备 (Inspiration Library)</div>
                      <div v-if="o.characterImage" class="insp-char">
                        <span class="insp-tag">[人设]</span>
                        <img :src="o.characterImage" class="insp-char-img" @click="openLightbox(getInspirationImages(o), 0)" />
                      </div>
                      <div v-if="(o.referenceImages || []).filter(Boolean).length > 0" class="insp-refs">
                        <span class="insp-tag">[动作参考]</span>
                        <div class="insp-ref-scroll">
                          <img v-for="(url, i) in (o.referenceImages || []).filter(Boolean)" :key="url"
                               :src="url" class="insp-ref-thumb"
                               @click="openLightbox(getInspirationImages(o), (o.characterImage ? 1 : 0) + i)" />
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <!-- ★ 移动端卡片 (含 el-collapse) -->
    <div class="card-list">
      <template v-for="group in groupedOrders" :key="'mg-' + group.date">
        <div class="card-date-header">{{ group.date }} · {{ group.orders.length }}单</div>
        <div v-for="o in group.orders" :key="o.id || o.orderNo" class="order-card"
             :style="{ borderLeftColor: lockLabel(o)==='hard' ? 'var(--purple)' : lockLabel(o)==='pre' ? '#bfa860' : o.status==='退款审核中' ? 'var(--danger)' : o.status==='已完成拍摄' ? 'var(--mint)' : isActiveStatus(o.status) ? '#7d9e9a' : '#b8bdb9' }">
        <div class="card-time">{{ fmtDateShort(getOrderDate(o)) }} {{ fmtBookingTime(o) }}</div>
        <div class="card-header">
          <span class="badge-cell" :class="statusBadge(o.status).cls">{{ statusBadge(o.status).label }}</span>
          <span v-if="(o.applicationStatus||o.application_status)==='RESCHEDULE_REQUESTED'" class="badge-cell s-warn">改期待批</span>
          <span v-if="(o.applicationStatus||o.application_status)==='CANCEL_REQUESTED'" class="badge-cell s-warn">取消待批</span>
          <span class="card-price">¥{{ fmtPrice(o.totalPrice || o.total_amount || 0) }}</span>
        </div>
        <div class="card-title">{{ o.studioTitle || o.studio_name || '—' }}<span v-if="o.roleName || o.role_name" class="card-role"> · {{ o.roleName || o.role_name }}</span></div>
        <div v-if="o.requestedNewTime || o.requested_new_time" class="card-resched-hint">申请改期至 {{ o.requestedNewTime || o.requested_new_time }}</div>
        <div class="btn-group" style="margin-top:8px;">
          <!-- ★ 待支付 → 确认收到定金 -->
          <el-button size="small" type="primary" v-if="o.status==='待支付' || o.status==='定金待确认'" @click="adminConfirmDeposit(o)" :type="o.status==='定金待确认' ? 'warning' : 'primary'">{{ o.status==='定金待确认' ? '核对流水并确认定金' : '确认收到定金' }}</el-button>
          <!-- ★ 已付定金 / 已确认 → 确定服务完成 -->
          <el-button size="small" type="success" v-if="o.status==='已付定金' || o.status==='已确认锁定'" @click="markFulfilledApi(o)">确定服务完成</el-button>
          <!-- ★ 尾款待确认 → 确认结清 -->
          <el-button size="small" type="primary" v-if="o.status==='尾款待确认'" @click="updateStatus(o.orderNo,'已结清')">确认结清</el-button>
          <!-- ★ 已结清 → 完成 -->
          <el-button size="small" type="success" v-if="o.status==='已结清'" @click="archiveOrder(o,'已完成拍摄')">完成</el-button>
          <!-- ★ 未结清 → 确认结清（高亮） -->
          <el-button size="small" type="warning" v-if="o.status==='未结清'" @click="confirmSettled(o)">确认结清</el-button>
          <!-- ★ 退款审核 -->
          <el-button size="small" type="success" v-if="o.status==='退款审核中'" @click="approveRefund(o)">同意退款</el-button>
          <el-button size="small" type="warning" v-if="o.status==='退款审核中'" @click="rejectRefund(o)">拒绝</el-button>
          <!-- ★ 取消：已确认状态隐藏 -->
          <el-button size="small" type="danger" plain v-if="(o.status==='待支付' || o.status==='定金待确认' || o.status==='尾款待确认' || o.status==='已结清') && o.status!=='退款审核中'" @click="archiveOrder(o,'已取消')">取消</el-button>
          <!-- ★ 已取消 -->
          <el-button size="small" type="warning" plain v-if="isCancelledOrder(o)" @click="restoreOrder(o)">恢复</el-button>
                    <el-button size="small" type="danger" plain v-if="isCancelledOrder(o)" @click="deleteOrder(o)">删除</el-button>

          <!-- ★ 新状态机：改期/取消审批 -->
          <template v-if="hasApplication(o, 'RESCHEDULE_REQUESTED')">
            <el-button size="small" type="success" @click="adminApproveReschedule(o)">同意改期</el-button>
            <el-button size="small" type="warning" @click="adminRejectReschedule(o)">拒绝</el-button>
          </template>
          <template v-if="hasApplication(o, 'CANCEL_REQUESTED')">
            <el-button size="small" type="danger" @click="adminApproveCancel(o)">同意取消</el-button>
            <el-button size="small" type="warning" @click="adminRejectCancel(o)">拒绝</el-button>
          </template>
        </div>
        <!-- ★ 折叠面板 -->
        <el-collapse style="margin-top:4px;">
          <el-collapse-item :title="'查看顾客特定订单要求 ▾'" :name="o.orderNo">
            <div class="collapse-detail">
              <div v-if="o.roleName || o.role_name"><strong>角色:</strong> {{ o.roleName || o.role_name }}</div>
              <div v-if="o.modelExperience || o.model_experience"><strong>经验:</strong> {{ o.modelExperience || o.model_experience }}</div>
              <div v-if="o.styleName || o.style_name"><strong>样式:</strong> {{ o.styleName || o.style_name }}</div>
              <div v-if="o.addonTotal > 0"><strong>附加:</strong> +¥{{ o.addonTotal }} ({{ (o.selectedAddonIds || []).length }} 项)</div>
              <div><strong>联系方式/备注:</strong> {{ o.contactNote || o.contact_note || o.contact || '—' }}</div>
              <div><strong>设备码:</strong> <code>{{ o.userDeviceId || o.user_device_id || '—' }}</code></div>
              <div v-if="o.refundText || o.refund_text"><strong>退款账号:</strong> {{ o.refundText || o.refund_text }}</div>
              <img v-if="o.refundImgUrl || o.refund_img_url" :src="o.refundImgUrl || o.refund_img_url" class="refund-thumb" />
              <div v-if="o.rejectReason || o.reject_reason" style="color:var(--danger);"><strong>拒绝:</strong> {{ o.rejectReason || o.reject_reason }}</div>
              <div style="color:var(--text-3);"><strong>订单号:</strong> {{ o.orderNo }} · {{ o.createdAt || o.created_at }}</div>
              <!-- ★ 灵感储备 -->
              <div v-if="getInspirationImages(o).length > 0" class="inspiration-library" style="margin-top:8px;">
                <div class="inspiration-title">客户拍摄灵感储备</div>
                <div v-if="o.characterImage" class="insp-char">
                  <span class="insp-tag">[人设]</span>
                  <img :src="o.characterImage" class="insp-char-img" @click="openLightbox(getInspirationImages(o), 0)" style="width:100px;height:100px;" />
                </div>
                <div v-if="(o.referenceImages || []).filter(Boolean).length > 0" class="insp-refs">
                  <span class="insp-tag">[动作参考]</span>
                  <div class="insp-ref-scroll">
                    <img v-for="(url, i) in (o.referenceImages || []).filter(Boolean)" :key="url"
                         :src="url" class="insp-ref-thumb"
                         @click="openLightbox(getInspirationImages(o), (o.characterImage ? 1 : 0) + i)" />
                  </div>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
        </div>
      </template>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pager">
      <el-button size="small" :disabled="page<=1" @click="goPage(page-1)">上一页</el-button>
      <span class="pager-info">{{ page }} / {{ totalPages }} (共{{ total }}条)</span>
      <el-button size="small" :disabled="page>=totalPages" @click="goPage(page+1)">下一页</el-button>
    </div>
  </div>

  <!-- ★ 全屏大图查看器 (Lightbox) -->
  <Teleport to="body">
    <div v-if="lightbox.visible" class="lightbox-overlay" @click.self="closeLightbox"
         @keydown="onLightboxKey" tabindex="0"
         @touchstart="onLightboxTouchStart" @touchend="onLightboxTouchEnd">
      <button class="lb-close" @click="closeLightbox">✕</button>
      <button v-if="lightbox.index > 0" class="lb-nav lb-prev" @click.stop="lightboxPrev">‹</button>
      <button v-if="lightbox.index < lightbox.images.length - 1" class="lb-nav lb-next" @click.stop="lightboxNext">›</button>
      <div class="lb-counter">{{ lightbox.index + 1 }} / {{ lightbox.images.length }}</div>
      <div class="lb-tag">{{ lightbox.images[lightbox.index]?.label }}</div>
      <img :src="lightbox.images[lightbox.index]?.url" class="lb-image" />
    </div>
  </Teleport>
</template>

<style scoped>
.order-mgmt { padding: 4px 0; }

/* ─── 统计 ─── */
.stats-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 14px; }
.stat-card { text-align: center; padding: 14px; border-radius: 14px; background: var(--surface-solid); border: 1px solid var(--border-color-solid); }
.stat-card .num { font-size: 26px; font-weight: 800; }
.stat-card .lbl { font-size: 11px; color: var(--text-sub); margin-top: 4px; }

/* ─── 日历 ─── */
.cal-view { background: var(--surface-solid); border-radius: 16px; padding: 14px; margin-bottom: 14px; border: 1px solid var(--border-color-solid); box-shadow: 0 2px 12px rgba(120,130,125,.04); }
.cal-nav { display: flex; justify-content: center; align-items: center; gap: 8px; margin-bottom: 10px; font-weight: 700; font-size: 15px; }
.cal-nav button { background: var(--color-neutral-tint); border: none; padding: 6px 14px; border-radius: var(--radius-btn); cursor: pointer; font-size: 13px; color: var(--color-primary-ink); font-weight: 600; transition: background-color var(--duration-1) var(--ease-out); }
.cal-nav button:hover { background: var(--color-primary-tint); }
/* 月份切换箭头原先是一个空的 <i>（Font Awesome 未加载），用户看不到任何可点元素。
   现在用真实图标 + 明确的按钮尺寸，并补上 aria-label。 */
.cal-nav-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; padding: 0 !important;
  font-size: 15px !important;
}
.btn-today { background: var(--color-primary) !important; color: var(--text-on-primary) !important; padding: 5px 12px !important; font-size: 11px !important; }
.cal-wdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 11px; color: var(--text-3); margin-bottom: 4px; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; text-align: center; }
.cal-cell { padding: 10px 2px; font-size: 13px; border-radius: var(--radius-sm); cursor: pointer; transition: background-color var(--duration-1) var(--ease-out); position: relative; color: var(--text-2); }
.cal-cell:hover { background: var(--color-neutral-tint); }
.cal-cell.today { font-weight: 700; color: var(--color-primary-ink); }
.cal-cell.selected { background: var(--color-primary-gradient); color: var(--text-on-primary); font-weight: 700; box-shadow: var(--shadow-primary); }
.cal-cell.past { color: var(--text-4); cursor: default; }
.cal-cell.past:hover { background: transparent; }
.cal-cell.has-order::after { content: ''; width: 5px; height: 5px; background: var(--color-info-ink); border-radius: 50%; position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); }
.cal-date-label { text-align: center; margin-top: 8px; font-size: 12px; color: var(--color-primary-ink); font-weight: 600; }

/* ─── ★ 24h排期条 ───
   与紧邻的 .cal-view 用同一套面板外观（实底 + 同一档圆角/边框/阴影），
   不再单独走半透明玻璃 —— 这一档上 --text-3 是不合法的，刻度字会不达标。 */
.timeline-wrap {
  background: var(--surface-solid);
  border-radius: var(--radius-xl); padding: 18px 20px; margin-bottom: 14px;
  border: 1px solid var(--border-color-solid);
  box-shadow: var(--shadow-1);
}
.tl-title { margin: 0 0 12px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; color: var(--text-1); flex-wrap: wrap; }
.tl-range { font-size: 11px; font-weight: 600; color: var(--text-3); margin-left: auto; font-family: var(--font-mono); }

/* 错误态：数据拿不到时必须说出来，而不是把整块面板藏掉 */
.tl-error {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 10px 12px; border-radius: var(--radius-md);
  background: var(--color-danger-tint); color: var(--color-danger-ink);
  font-size: 12px; font-weight: 600;
}

/* 小时刻度：与 .tl-bar 同宽、同样按百分比定位，标签才能落在色块正上方 */
.tl-axis { position: relative; height: 15px; margin-bottom: 4px; }
.tl-axis-label {
  position: absolute; top: 0; transform: translateX(-50%);
  font-size: 10px; font-weight: 600; color: var(--text-3);
  font-family: var(--font-mono); white-space: nowrap;
}

.tl-bar {
  display: flex; height: 48px; border-radius: var(--radius-md);
  overflow: hidden; background: var(--bg-sunken);
}
/* ── 排期段 ── */
.tl-seg {
  height: 100%; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; overflow: hidden; white-space: nowrap;
  text-overflow: ellipsis; cursor: default;
  transition: width var(--duration-3) var(--ease-out);
}
/* 分段细线用 inset 阴影画：不占布局宽度，色块百分比才不会和上面的刻度错位 */
.tl-seg + .tl-seg { box-shadow: inset 1px 0 0 rgba(255, 255, 255, .8); }

/* 空闲：中性底。原先文字是 transparent、底色比轨道还浅，
   整天没排期时整条就是一根看不出内容的空白带，商家以为功能坏了。 */
.tl-seg.free { background: var(--color-neutral-tint); color: var(--color-neutral-ink); }

/* 休息：琥珀虚线（固定休息 + 拍摄后的自动休息同款） */
.tl-seg.rest, .tl-seg.rest_tail {
  background: var(--color-warning-tint); color: var(--color-warning-ink);
  border-left: 1.5px dashed var(--color-warning);
  border-right: 1.5px dashed var(--color-warning);
}
.tl-seg.rest_tail { font-size: 10px; }

/* 预锁：定金待审 —— 蓝灰斜纹，表示"占位但未确认" */
.tl-seg.pre_lock, .tl-seg.pre-lock {
  background-color: var(--color-info-tint); color: var(--color-info-ink);
  background-image: repeating-linear-gradient(-40deg, transparent, transparent 5px, rgba(74, 107, 138, .12) 5px, rgba(74, 107, 138, .12) 10px);
}

/* 硬锁：已确认 —— 绿底实心，与预锁一眼可分 */
.tl-seg.hard_lock, .tl-seg.hard-lock {
  background-color: var(--color-success-tint); color: var(--color-success-ink);
  background-image: repeating-linear-gradient(-40deg, transparent, transparent 6px, rgba(62, 107, 78, .12) 6px, rgba(62, 107, 78, .12) 12px);
}
.tl-seg-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 6px; }

.tl-hint { margin: 8px 0 0; font-size: 11px; color: var(--text-3); }

/* 操作行（导出 / 导入） */
.tl-actions {
  display: flex; gap: 8px; flex-wrap: wrap;
  margin-top: 10px; justify-content: flex-end;
}

/* ─── Excel 快速导入弹窗 ─── */
.imp-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.imp-label { flex-shrink: 0; width: 44px; font-size: 13px; font-weight: 600; color: var(--text-2); }
.imp-hint {
  margin: 4px 0 16px; padding: 10px 12px; border-radius: var(--radius-md);
  background: var(--color-info-tint); color: var(--color-info-ink);
  font-size: 12px; line-height: 1.8;
}
.imp-hint strong { font-weight: 700; }
.imp-empty {
  margin: 4px 0 16px; padding: 10px 12px; border-radius: var(--radius-md);
  background: var(--color-warning-tint); color: var(--color-warning-ink);
  font-size: 12px; line-height: 1.8;
}
.imp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.imp-errors { margin-top: 16px; }
.imp-errors-title {
  margin-bottom: 8px; font-size: 13px; font-weight: 700; color: var(--color-danger-ink);
}

/* 图例：色块与时间条同源。此前图例是灰的、条上是橙/绿的，两边对不上。 */
.tl-legend { display: flex; gap: 14px; margin-top: 10px; flex-wrap: wrap; font-size: 11px; color: var(--text-3); }
.ldot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.ldot.free { background: var(--color-neutral-tint); border: 1px solid var(--color-disabled); }
.ldot.rest, .ldot.rest_tail { background: var(--color-warning-tint); border: 1px solid var(--color-warning); }
.ldot.pre_lock {
  background-color: var(--color-info-tint); border: 1px solid var(--color-info);
  background-image: repeating-linear-gradient(-40deg, transparent, transparent 2px, rgba(74, 107, 138, .35) 2px, rgba(74, 107, 138, .35) 4px);
}
.ldot.hard_lock {
  background-color: var(--color-success-tint); border: 1px solid var(--color-success);
  background-image: repeating-linear-gradient(-40deg, transparent, transparent 2px, rgba(62, 107, 78, .35) 2px, rgba(62, 107, 78, .35) 4px);
}

/* ─── Tab ─── */
.tabs { display: flex; gap: 2px; margin-bottom: 14px; background: var(--color-disabled-bg); border-radius: 16px; padding: 4px; flex-wrap: wrap; border: none; }
.tab-item { flex: 1; min-width: 60px; text-align: center; padding: 10px 6px; border-radius: 14px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all .2s; color: var(--text-sub); }
.tab-item.active { background: var(--surface-solid); color: var(--color-primary-ink); box-shadow: 0 2px 10px rgba(var(--color-primary-rgb), .08); }

/* ─── 搜索 ─── */
.search-row { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
.input-field { flex: 1; min-width: 160px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 13px; outline: none; background: var(--surface-solid); }
.date-only-switch { flex-shrink: 0; }

/* ─── 表格 ─── */
.table-wrap { overflow-x: auto; border-radius: 16px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { background: var(--bg-table-stripe); padding: 10px 12px; text-align: left; font-weight: 600; color: var(--text-sub); border-bottom: 2px solid var(--border-subtle); }
.data-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-subtle); vertical-align: middle; }
.clickable-row { cursor: pointer; transition: background .1s; }
.clickable-row:hover { background: rgba(125,158,138,0.03); }
.row-待支付 { background: rgba(201,184,150,.03); }
.row-已确认锁定 { background: rgba(123,168,130,.03); }
.time-block { display: inline-block; padding: 4px 12px; border-radius: 14px; background: var(--color-primary-light); color: var(--color-primary-ink); font-weight: 700; font-family: 'SF Mono', monospace; font-size: 13px; white-space: nowrap; }
.time-date-prefix { font-size: 11px; color: var(--text-sub); font-weight: 600; margin-right: 4px; }
.lock-dot { margin-left: 4px; vertical-align: -0.1em; }
.cell-title { font-weight: 600; }
.cell-role { font-size: 11px; color: var(--color-primary-ink); margin-top: 1px; }
.cell-price { font-weight: 700; }
.cell-deposit { font-size: 10px; color: var(--text-sub); }
.badge-cell { font-size: 10px; padding: 3px 8px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
.badge-pending { background: rgba(249,224,160,0.20); color: var(--color-warning-ink); }
.badge-deposit-pending { background: rgba(255,200,120,0.25); color: #D4782E; }
.badge-prepaid { background: rgba(169,193,217,0.20); color: var(--color-info-ink); }
.badge-confirmed { background: rgba(var(--color-primary-rgb), 0.15); color: var(--color-primary-ink); }
.badge-paid { background: rgba(168,216,185,0.20); color: var(--color-success-ink); }
.badge-unsettled { background: rgba(var(--color-primary-rgb), 0.22); color: #C77A2E; }
.badge-completed { background: rgba(168,216,185,0.15); color: var(--color-success-ink); }
.badge-cancelled { background: rgba(180,180,190,0.12); color: var(--text-3); }
.badge-refunding { background: rgba(239,168,168,0.18); color: var(--color-danger-ink); }
.pending-alert-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 12px; border-radius: 14px;
  background: rgba(255,140,60,0.18); color: #D46820;
  font-size: 12px; font-weight: 700;
  animation: pendingPulse 1.8s ease-in-out infinite;
}
@keyframes pendingPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.65; transform: scale(1.04); }
}
.btn-group { display: flex; gap: 8px; flex-wrap: wrap; }

/* ─── 展开行 ─── */
.expand-row td { background: var(--bg-table-stripe); border-bottom: 2px solid var(--border-subtle); padding: 0; }
.expand-content { padding: 12px 16px; }
.expand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px 16px; font-size: 12px; line-height: 1.8; }
.expand-grid code { font-size: 10px; background: var(--color-disabled-bg); padding: 2px 6px; border-radius: 6px; }
.refund-thumb { max-width: 120px; border-radius: 10px; margin-top: 4px; border: 1px solid var(--border-subtle); }

/* ─── 移动端卡片 ─── */
.card-list { display: none; }
.order-card { padding: 14px; margin-bottom: 8px; background: var(--surface-solid); border-radius: 16px; border: 1px solid var(--border-subtle); border-left: 4px solid; }
.card-time { font-size: 18px; font-weight: 800; color: var(--color-primary-ink); font-family: 'SF Mono', monospace; margin-bottom: 6px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.card-price { font-weight: 700; }
.card-title { font-size: 13px; }
.card-role { color: var(--color-primary-ink); }
.card-resched-hint {
  font-size: 11px; color: var(--color-warning-ink); margin-top: 4px;
  padding: 4px 8px; background: #FFF8E1; border-radius: 6px;
}
.s-warn { background: #FFF8E1; color: var(--color-warning-ink); }
.collapse-detail { font-size: 12px; line-height: 2; }
.collapse-detail code { font-size: 10px; background: var(--color-disabled-bg); padding: 2px 6px; border-radius: 6px; }

/* ─── 客户拍摄灵感储备 ─── */
.inspiration-library {
  margin-top:14px; padding:14px 16px; background:rgba(254,247,239,.35);
  border:1px solid rgba(var(--color-primary-rgb), .12); border-radius:16px;
}
.inspiration-title { font-size:12px; font-weight:700; color: var(--color-primary-ink); margin-bottom:10px; }
.insp-tag { font-size:10px; font-weight:700; color:var(--color-warning-ink); margin-right:8px; }
.insp-char { display:flex; align-items:flex-start; gap:8px; margin-bottom:10px; }
.insp-char-img { width:120px; height:120px; object-fit:cover; border-radius:12px; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.06); transition:transform .2s; }
.insp-char-img:hover { transform:scale(1.04); }
.insp-refs { display:flex; align-items:flex-start; gap:8px; }
.insp-ref-scroll { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; flex:1; -webkit-overflow-scrolling:touch; }
.insp-ref-thumb { width:72px; height:72px; object-fit:cover; border-radius:10px; cursor:pointer; flex-shrink:0; box-shadow:0 2px 6px rgba(0,0,0,.04); transition:transform .2s; }
.insp-ref-thumb:hover { transform:scale(1.08); }

/* ─── 全屏大图查看器 (Lightbox) ─── */
.lightbox-overlay {
  position:fixed; inset:0; z-index:9999;
  background:rgba(0,0,0,.88); backdrop-filter:blur(20px);
  display:flex; align-items:center; justify-content:center;
  animation:lbFadeIn .25s ease;
}
@keyframes lbFadeIn { from { opacity:0; } to { opacity:1; } }
.lb-close {
  position:absolute; top:20px; right:24px; z-index:10;
  background:rgba(255,255,255,.12); border:none; color: var(--text-inverse);
  font-size:22px; width:44px; height:44px; border-radius:50%;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:background .15s;
}
.lb-close:hover { background:rgba(255,255,255,.22); }
.lb-nav {
  position:absolute; top:50%; transform:translateY(-50%); z-index:10;
  background:rgba(255,255,255,.08); border:none; color: var(--text-inverse);
  font-size:40px; width:56px; height:80px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  border-radius:8px; transition:background .15s;
}
.lb-nav:hover { background:rgba(255,255,255,.18); }
.lb-prev { left:12px; }
.lb-next { right:12px; }
.lb-counter { position:absolute; top:24px; left:50%; transform:translateX(-50%); z-index:10; color:rgba(255,255,255,.7); font-size:14px; font-weight:600; }
.lb-tag { position:absolute; bottom:32px; left:50%; transform:translateX(-50%); z-index:10; color:rgba(255,255,255,.55); font-size:12px; font-weight:600; background:rgba(255,255,255,.08); padding:4px 14px; border-radius:20px; }
.lb-image { max-width:90vw; max-height:78vh; object-fit:contain; border-radius:8px; box-shadow:0 8px 40px rgba(0,0,0,.3); }
@media (max-width:767px) {
  .lb-nav { width:40px; height:60px; font-size:30px; }
  .lb-image { max-width:96vw; max-height:70vh; }
}

/* ─── 分页 ─── */
.pager { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 14px; }
.pager-info { font-size: 12px; color: var(--text-sub); }
.empty { text-align: center; padding: 40px; color: var(--text-sub); }

/* ─── 日期分组行 ─── */
.date-group-row td { padding: 0; border-bottom: none; }
.date-group-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; margin-top: 8px;
  background: linear-gradient(135deg, var(--bg-table-stripe), #F9F6F0);
  border-left: 4px solid var(--color-primary);
  border-radius: 8px;
}
.date-group-label { font-size: 14px; font-weight: 700; color: var(--text-1); }
.date-group-count { font-size: 11px; color: var(--text-sub); background: var(--border-subtle); padding: 2px 8px; border-radius: 8px; }

/* ─── 日期列 ─── */
.cell-date { font-size: 12px; color: var(--text-sub); white-space: nowrap; }

/* ─── 移动端日期头部 ─── */
.card-date-header {
  font-size: 13px; font-weight: 700; color: var(--text-1); padding: 8px 12px;
  background: linear-gradient(135deg, var(--bg-table-stripe), #F9F6F0);
  border-left: 4px solid var(--color-primary); border-radius: 8px;
  margin-bottom: 6px; margin-top: 12px;
}
.card-date { font-size: 12px; color: var(--text-sub); margin-bottom: 2px; }

@media (max-width: 768px) {
  .table-wrap { display: none; }
  .card-list { display: flex; flex-direction: column; gap: 10px; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 769px) {
  .card-list { display: none; }
}

/* ══════════════════════════════════════════════════════════════
   图片灯箱 · glass 主题
   -------------------------------------------------------------
   这段只作用于 glass（全部以 `:root[data-theme="glass"]` 开头，classic 下
   一行都不命中）。写在组件 scoped 块里是因为 .lb-* 是本组件私有类，
   在主 CSS 包里覆盖会因加载顺序（路由 chunk 晚于主 CSS）而失败。

   为什么要改：原控制按钮是 `rgba(255,255,255,.08~.12)` 的低对比玻璃。
   实测按钮边界对比度只有 **1.27:1**（要求 ≥3:1）—— 白色字形本身没问题
   （13.4:1），但按钮的**形状**几乎看不见，等于一排浮在图上的符号，
   不符合「一眼可见且可点」。

   做法：把控制件改成高不透明实底 + 深色字形，遮罩同时压深到 .94。
   遮罩更深不是为了好看，是为了让照片与界面分离得更干净 ——
   看片场景下任何与照片争夺注意力的东西都是干扰。
   ══════════════════════════════════════════════════════════════ */
:root[data-theme="glass"] .lightbox-overlay {
  background: rgba(4, 12, 26, .94);
}

:root[data-theme="glass"] .lb-close,
:root[data-theme="glass"] .lb-nav {
  background: rgba(255, 255, 255, .94);
  color: var(--text-1);
  border: 1px solid rgba(255, 255, 255, .98);
  box-shadow: 0 4px 16px rgba(0, 0, 0, .45);
}
:root[data-theme="glass"] .lb-close:hover,
:root[data-theme="glass"] .lb-nav:hover {
  background: #FFFFFF;
}
:root[data-theme="glass"] .lb-close:focus-visible,
:root[data-theme="glass"] .lb-nav:focus-visible {
  outline: 2px solid #FFFFFF;
  outline-offset: 2px;
}
/* 键盘方向键可以切换图片，但按钮本身此前没有焦点样式 ——
   补上，否则 Tab 到控制件时完全看不出焦点在哪。 */
:root[data-theme="glass"] .lb-close:focus-visible { outline-offset: 3px; }

/* 计数器与标签：压深遮罩后原透明度已足够，但把计数器提到实白，
   它是「第几张 / 共几张」这一关键定位信息，不该是半透明的。 */
:root[data-theme="glass"] .lb-counter {
  color: #FFFFFF;
  font-variant-numeric: tabular-nums;
}
:root[data-theme="glass"] .lb-tag {
  color: #FFFFFF;
  background: rgba(255, 255, 255, .16);
}

/* 触屏：控制件加大命中区。原尺寸在 375px 上已降到 40×60，仍偏窄。 */
@media (max-width: 767px) {
  :root[data-theme="glass"] .lb-close { width: 48px; height: 48px; }
  :root[data-theme="glass"] .lb-nav { width: 48px; height: 72px; }
}

/* ══════════════════════════════════════════════════════════════
   金额数字 · glass 主题
   -------------------------------------------------------------
   订单表里金额是逐行对照阅读的（这家收了多少、定金多少），
   比例字体下每行数字宽度不同，纵向扫视时会跳。用等宽数字消除。

   tabular-nums 会改变数字的字宽 → 属于会影响布局的属性，
   所以只在 glass 下开，classic 保持原样。
   ══════════════════════════════════════════════════════════════ */
:root[data-theme="glass"] .cell-price,
:root[data-theme="glass"] .cell-deposit,
:root[data-theme="glass"] .card-price {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}
/* 表格里的金额列右对齐：数字右对齐后小数点/位数天然成列，
   左对齐时「¥1200」与「¥80」的视觉起点一致但终点参差。 */
:root[data-theme="glass"] .cell-price,
:root[data-theme="glass"] .cell-deposit {
  text-align: right;
}

/* ── 让表头吸顶真正生效 ──
   glass-app.css 里给 .data-table thead th 加了 position: sticky。但本表的
   容器 .table-wrap 带 `overflow-x: auto` —— 按 CSS 规范，overflow-x 非 visible
   时 overflow-y 会被计算成 auto，于是 .table-wrap 成了**纵向滚动容器**；
   而它高度自适应、纵向根本不会滚，sticky 因此无处可粘。

   给它一个最大高度、让它自己纵向滚动，表头才会在滚动时留在顶部。
   代价是引入了嵌套滚动（页面滚 + 表格滚）。对订单这种长列表 + 需要横向滚动的
   宽表，这是行业通行做法，且没有滚动表头的话横向滚动时完全不知道自己看的是哪一列。
   classic 下不生效，保持原有的整页滚动。 */
:root[data-theme="glass"] .table-wrap {
  max-height: 72vh;
  overflow-y: auto;
  /* 表头有背景色，横向滚动时不会透出后面的单元格 */
  overscroll-behavior: contain;
}
</style>
