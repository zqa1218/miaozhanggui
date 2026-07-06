<script setup>
import { ref, computed, onMounted, onUnmounted, watch, reactive, inject } from 'vue'
import { storage } from '@/utils/storage'
import { ElMessage } from 'element-plus'

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
  // 当月第一天
  const firstDay = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01'
  dateFilter.value = firstDay
  calSelectedDate.value = firstDay
  page.value = 1
  fetchOrders()
  loadTimeline()
}
async function loadCalendarDates() {
  calLoading.value = true
  try {
    const y = calYear.value, m = calMonth.value
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`
    const res = await apiFetch(`/api/orders?mId=${mId.value}&page=1&pageSize=200&date=${startDate}`)
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
async function loadTimeline() {
  timelineSegments.value = []
  if (!calSelectedDate.value || !mId.value) return
  try {
    const res = await apiFetch(`/api/booked-times-v2?mId=${mId.value}&date=${calSelectedDate.value}`)
    const data = (res.data || res)
    const booked = data.bookedRanges || []
    const rests = data.restRanges || []
    timelineRange.value = { start: data.baseStartTime || '09:00', end: data.baseEndTime || '21:00' }
    buildTimelineSegments(timelineRange.value.start, timelineRange.value.end, rests, booked)
  } catch (e) {
    console.error('[loadTimeline] 加载排期失败:', e.message)
  }
}
function buildTimelineSegments(baseStart, baseEnd, rests, booked) {
  const totalMin = toMin(baseEnd) - toMin(baseStart)
  if (totalMin <= 0) { timelineSegments.value = []; return }

  const items = []
  // 固定休息时段（商家设置）
  for (const r of rests) {
    items.push({ s: Math.max(toMin(r.start), toMin(baseStart)), e: Math.min(toMin(r.end), toMin(baseEnd)), type: 'rest', label: r.start + '-' + r.end })
  }
  // 已预约时段：按 restMinutes 拆分为拍摄段 + 休息段
  for (const b of booked) {
    const s = Math.max(toMin(b.start), toMin(baseStart))
    const e = Math.min(toMin(b.end), toMin(baseEnd))
    const restMin = b.restMinutes || 0
    if (restMin > 0 && e - s > restMin) {
      // 拆分：拍摄段
      const shootEnd = e - restMin
      items.push({ s, e: shootEnd, type: b.lockType || 'pre_lock', label: ((b.roleName||'') + ' ' + toTime(s) + '-' + toTime(shootEnd)).trim(), orderNo: b.orderNo })
      // 休息段：琥珀虚线
      items.push({ s: shootEnd, e, type: 'rest_tail', label: '休息 ' + restMin + 'min', orderNo: b.orderNo })
    } else {
      const label = (b.roleName || '') + ' ' + toTime(s) + '-' + toTime(e)
      items.push({ s, e, type: b.lockType || 'pre_lock', label: label.trim(), orderNo: b.orderNo })
    }
  }
  items.sort((a, b) => a.s - b.s)
  const result = []
  let cursor = toMin(baseStart)
  for (const it of items) {
    if (it.e <= cursor) continue
    const segStart = Math.max(it.s, cursor)
    if (segStart > cursor) {
      result.push({ type: 'free', w: (segStart - cursor) / totalMin * 100, label: '', tooltip: toTime(cursor) + '-' + toTime(segStart) })
    }
    result.push({ type: it.type, w: (it.e - segStart) / totalMin * 100, label: it.label, tooltip: it.label + (it.orderNo ? ' (' + it.orderNo + ')' : '') })
    cursor = it.e
  }
  const endMin = toMin(baseEnd)
  if (cursor < endMin) {
    result.push({ type: 'free', w: (endMin - cursor) / totalMin * 100, label: '', tooltip: toTime(cursor) + '-' + baseEnd })
  }
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

async function handleImportFile(e) {
  const file = e.target.files[0]
  if (!file) return
  if (!/\.xlsx?$/i.test(file.name)) { ElMessage.warning('仅支持 .xlsx 或 .xls 格式'); return }
  if (!confirm(`确认导入「${file.name}」？系统将逐行校验并批量创建订单。`)) { e.target.value = ''; return }
  importing.value = true
  try {
    const token = getToken()
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/order/import', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }).then(r => r.json())
    if (res.success || res.code === 0) {
      ElMessage.success(res.message || '导入成功')
      fetchOrders(); loadCalendarDates(); loadTimeline()
    } else {
      ElMessage.error(res.message || '导入失败')
    }
  } catch { ElMessage.error('网络错误，导入失败') }
  importing.value = false
  e.target.value = ''
}

async function downloadTemplate() {
  const token = getToken()
  if (!token) { window.location.href = '/admin/login'; return }
  try {
    const res = await fetch('/api/order/import-template', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('下载失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '预约订单导入模板.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch { ElMessage.error('模板下载失败') }
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
      <div class="stat-card"><div class="num" style="color:var(--color-primary);">¥{{ todayRevenue }}</div><div class="lbl">今日营收</div></div>
      <div class="stat-card"><div class="num" style="color:#7d9e9a;">{{ stats.active }}</div><div class="lbl">进行中</div></div>
      <div class="stat-card"><div class="num" style="color:var(--color-warning);">{{ stats.refunding }}</div><div class="lbl">退款审核</div></div>
      <div class="stat-card"><div class="num" style="color:var(--color-success);">{{ stats.completed }}</div><div class="lbl">已归档</div></div>
    </div>

    <!-- 日历 -->
    <div class="cal-view">
      <div class="cal-nav">
        <button @click="calPrevMonth"><i class="fa-solid fa-chevron-left"></i></button>
        <span>{{ calYear }}年 {{ calMonth }}月</span>
        <button @click="calNextMonth"><i class="fa-solid fa-chevron-right"></i></button>
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
    <div class="timeline-wrap" v-if="calSelectedDate && timelineSegments.length > 0">
      <h4 class="tl-title"><i class="fa-solid fa-chart-gantt"></i> {{ calSelectedDate }} 排期看板</h4>
      <div class="tl-bar">
        <div v-for="(seg, i) in timelineSegments" :key="i"
             :class="['tl-seg', seg.type]"
             :style="{ width: seg.w + '%' }"
             :title="seg.tooltip">
          <span v-if="seg.type !== 'free'" class="tl-seg-label">{{ seg.label }}</span>
        </div>
      </div>
      <div class="tl-legend">
        <span><span class="ldot free"></span>空闲</span>
        <span><span class="ldot rest"></span>休息</span>
        <span><span class="ldot rest_tail"></span>休息(自动)</span>
        <span><span class="ldot prelock"></span>预锁</span>
        <span><span class="ldot hardlock"></span>硬锁</span>
        <span style="margin-left:auto;display:flex;gap:8px;">
          <el-button size="small" @click="exportOrders">
            📤 导出当前订单
          </el-button>
          <el-button size="small" @click="triggerImport">
            📥 导入订单Excel
          </el-button>
          <el-button size="small" @click="downloadTemplate">
            📄 下载空白导入模板
          </el-button>
        </span>
        <input ref="importFileInput" type="file" accept=".xlsx,.xls" style="display:none" @change="handleImportFile" />
      </div>
    </div>

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
    <div v-else-if="orders.length===0" class="empty">暂无订单</div>

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
                  <span v-if="lockLabel(o)" :class="'lock-dot ' + lockLabel(o)">{{ lockLabel(o)==='pre'?'🔒':'✅' }}</span>
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
              <div style="color:#aaa;"><strong>订单号:</strong> {{ o.orderNo }} · {{ o.createdAt || o.created_at }}</div>
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
.stat-card { text-align: center; padding: 14px; border-radius: 14px; background: #fff; border: 1px solid var(--border-color-solid); }
.stat-card .num { font-size: 26px; font-weight: 800; }
.stat-card .lbl { font-size: 11px; color: var(--text-sub); margin-top: 4px; }

/* ─── 日历 ─── */
.cal-view { background: #fff; border-radius: 16px; padding: 14px; margin-bottom: 14px; border: 1px solid var(--border-color-solid); box-shadow: 0 2px 12px rgba(120,130,125,.04); }
.cal-nav { display: flex; justify-content: center; align-items: center; gap: 8px; margin-bottom: 10px; font-weight: 700; font-size: 15px; }
.cal-nav button { background: #eef1ee; border: none; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; color: var(--color-primary); font-weight: 600; transition: .2s; }
.cal-nav button:hover { background: var(--color-primary-light); }
.btn-today { background: var(--color-primary) !important; color: #fff !important; padding: 5px 12px !important; font-size: 11px !important; }
.cal-wdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 11px; color: var(--text-sub); margin-bottom: 4px; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; text-align: center; }
.cal-cell { padding: 10px 2px; font-size: 13px; border-radius: 10px; cursor: pointer; transition: .15s; position: relative; color: var(--text-secondary); }
.cal-cell:hover { background: #eef1ee; }
.cal-cell.today { font-weight: 700; color: var(--color-primary); }
.cal-cell.selected { background: var(--color-primary-gradient); color: #fff; font-weight: 700; box-shadow: 0 3px 12px rgba(125,158,138,.3); }
.cal-cell.past { color: #c8c8cc; cursor: default; }
.cal-cell.past:hover { background: transparent; }
.cal-cell.has-order::after { content: ''; width: 5px; height: 5px; background: var(--color-sakura); border-radius: 50%; position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); }
.cal-date-label { text-align: center; margin-top: 8px; font-size: 12px; color: var(--color-primary); font-weight: 600; }

/* ─── ★ 24h排期条 ─── */
.timeline-wrap {
  background: rgba(255,255,255,0.70);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border-radius: 20px; padding: 18px 20px; margin-bottom: 14px;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 2px 16px rgba(120,130,125,0.06), inset 0 1px 0 rgba(255,255,255,0.5);
}
.tl-title { margin: 0 0 12px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; color: rgba(0,0,0,0.5); }
.tl-bar { display: flex; height: 48px; border-radius: 12px; overflow: hidden; min-width: 400px; gap: 1px; background: rgba(245,238,220,0.50); }
/* ── 排期段：清新浅色高对比 ── */
.tl-seg {
  height: 100%; display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600; overflow: hidden; white-space: nowrap;
  text-overflow: ellipsis; cursor: default;
  transition: all 0.35s ease;
}
.tl-seg:first-child { border-radius: 10px 0 0 10px; }
.tl-seg:last-child  { border-radius: 0 10px 10px 0; }

/* 空闲：卡其清透玻璃 */
.tl-seg.free {
  background: rgba(255,252,242,0.35);
  backdrop-filter: blur(4px);
  color: transparent;
}

/* 休息：琥珀虚线 */
.tl-seg.rest {
  background: rgba(240,210,160,0.18);
  backdrop-filter: blur(4px);
  border: 1.5px dashed rgba(200,150,80,0.28);
  color: rgba(180,120,50,0.55);
}

/* 预锁：定金待审 — 半透明斜线斑马纹 */
.tl-seg.pre_lock, .tl-seg.pre-lock {
  background: rgba(255,180,100,0.28);
  backdrop-filter: blur(6px);
  color: rgba(180,100,30,0.65);
  background-image: repeating-linear-gradient(
    -40deg, transparent, transparent 5px,
    rgba(255,255,255,0.25) 5px, rgba(255,255,255,0.25) 10px
  );
  position: relative;
}
.tl-seg.pre_lock .tl-seg-label::after,
.tl-seg.pre-lock .tl-seg-label::after {
  content: ' 定金待审';
  font-size: 9px;
  opacity: 0.7;
}

/* 硬锁：已确认 — 实心毛玻璃 */
.tl-seg.hard_lock, .tl-seg.hard-lock {
  background: rgba(130,170,150,0.55);
  backdrop-filter: blur(12px);
  color: rgba(0,0,0,0.52);
  background-image: repeating-linear-gradient(
    -40deg, transparent, transparent 6px,
    rgba(255,255,255,0.18) 6px, rgba(255,255,255,0.18) 12px
  );
}
/* 拍摄后的自动休息段：琥珀虚线 */
.tl-seg.rest_tail {
  background: rgba(240,210,160,0.18);
  backdrop-filter: blur(4px);
  border: 1.5px dashed rgba(200,150,80,0.28);
  color: rgba(180,120,50,0.55);
  font-size: 9px;
}
.tl-seg-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 6px; }

/* 图例 */
.tl-legend { display: flex; gap: 14px; margin-top: 10px; flex-wrap: wrap; font-size: 11px; color: rgba(0,0,0,0.30); }
.ldot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.ldot.free { background: rgba(200,200,210,0.45); }
.ldot.rest { background: transparent; border: 1.5px dashed rgba(200,150,80,0.5); }
.ldot.rest_tail { background: rgba(240,210,160,0.4); border: 1.5px dashed rgba(200,150,80,0.5); }
.ldot.prelock {
  background: rgba(190,190,200,0.50);
  background-image: repeating-linear-gradient(-40deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px);
}
.ldot.hardlock {
  background: rgba(170,175,185,0.60);
  background-image: repeating-linear-gradient(-40deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px);
}

/* ─── Tab ─── */
.tabs { display: flex; gap: 2px; margin-bottom: 14px; background: #F4F2EE; border-radius: 16px; padding: 4px; flex-wrap: wrap; border: none; }
.tab-item { flex: 1; min-width: 60px; text-align: center; padding: 10px 6px; border-radius: 14px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all .2s; color: var(--text-sub); }
.tab-item.active { background: #fff; color: var(--color-primary); box-shadow: 0 2px 10px rgba(244,164,96,.08); }

/* ─── 搜索 ─── */
.search-row { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
.input-field { flex: 1; min-width: 160px; padding: 8px 12px; border: 1px solid #E8E5DF; border-radius: 10px; font-size: 13px; outline: none; background: #fff; }
.date-only-switch { flex-shrink: 0; }

/* ─── 表格 ─── */
.table-wrap { overflow-x: auto; border-radius: 16px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { background: #FDFBF7; padding: 10px 12px; text-align: left; font-weight: 600; color: var(--text-sub); border-bottom: 2px solid #F0EDE8; }
.data-table td { padding: 10px 12px; border-bottom: 1px solid #F0EDE8; vertical-align: middle; }
.clickable-row { cursor: pointer; transition: background .1s; }
.clickable-row:hover { background: rgba(125,158,138,0.03); }
.row-待支付 { background: rgba(201,184,150,.03); }
.row-已确认锁定 { background: rgba(123,168,130,.03); }
.time-block { display: inline-block; padding: 4px 12px; border-radius: 14px; background: var(--color-primary-light); color: var(--color-primary-dark); font-weight: 700; font-family: 'SF Mono', monospace; font-size: 13px; white-space: nowrap; }
.time-date-prefix { font-size: 11px; color: var(--text-sub); font-weight: 600; margin-right: 4px; }
.lock-dot { font-size: 10px; margin-left: 4px; }
.cell-title { font-weight: 600; }
.cell-role { font-size: 11px; color: var(--color-sakura); margin-top: 1px; }
.cell-price { font-weight: 700; }
.cell-deposit { font-size: 10px; color: var(--text-sub); }
.badge-cell { font-size: 10px; padding: 3px 8px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
.badge-pending { background: rgba(249,224,160,0.20); color: #B8933E; }
.badge-deposit-pending { background: rgba(255,200,120,0.25); color: #D4782E; }
.badge-prepaid { background: rgba(169,193,217,0.20); color: #5A7A9A; }
.badge-confirmed { background: rgba(244,164,96,0.15); color: #D4893E; }
.badge-paid { background: rgba(168,216,185,0.20); color: #5A8A6A; }
.badge-unsettled { background: rgba(244,164,96,0.22); color: #C77A2E; }
.badge-completed { background: rgba(168,216,185,0.15); color: #5A8A6A; }
.badge-cancelled { background: rgba(180,180,190,0.12); color: #888; }
.badge-refunding { background: rgba(239,168,168,0.18); color: #C87878; }
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
.expand-row td { background: #FDFBF7; border-bottom: 2px solid #F0EDE8; padding: 0; }
.expand-content { padding: 12px 16px; }
.expand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px 16px; font-size: 12px; line-height: 1.8; }
.expand-grid code { font-size: 10px; background: #F4F2EE; padding: 2px 6px; border-radius: 6px; }
.refund-thumb { max-width: 120px; border-radius: 10px; margin-top: 4px; border: 1px solid #F0EDE8; }

/* ─── 移动端卡片 ─── */
.card-list { display: none; }
.order-card { padding: 14px; margin-bottom: 8px; background: #fff; border-radius: 16px; border: 1px solid #F0EDE8; border-left: 4px solid; }
.card-time { font-size: 18px; font-weight: 800; color: var(--color-primary-dark); font-family: 'SF Mono', monospace; margin-bottom: 6px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.card-price { font-weight: 700; }
.card-title { font-size: 13px; }
.card-role { color: var(--color-sakura); }
.card-resched-hint {
  font-size: 11px; color: #F9A825; margin-top: 4px;
  padding: 4px 8px; background: #FFF8E1; border-radius: 6px;
}
.s-warn { background: #FFF8E1; color: #F9A825; }
.collapse-detail { font-size: 12px; line-height: 2; }
.collapse-detail code { font-size: 10px; background: #F4F2EE; padding: 2px 6px; border-radius: 6px; }

/* ─── 客户拍摄灵感储备 ─── */
.inspiration-library {
  margin-top:14px; padding:14px 16px; background:rgba(254,247,239,.35);
  border:1px solid rgba(244,164,96,.12); border-radius:16px;
}
.inspiration-title { font-size:12px; font-weight:700; color:#D4893E; margin-bottom:10px; }
.insp-tag { font-size:10px; font-weight:700; color:#B08050; margin-right:8px; }
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
  background:rgba(255,255,255,.12); border:none; color:#fff;
  font-size:22px; width:44px; height:44px; border-radius:50%;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:background .15s;
}
.lb-close:hover { background:rgba(255,255,255,.22); }
.lb-nav {
  position:absolute; top:50%; transform:translateY(-50%); z-index:10;
  background:rgba(255,255,255,.08); border:none; color:#fff;
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
  background: linear-gradient(135deg, #FDFBF7, #F9F6F0);
  border-left: 4px solid var(--color-primary);
  border-radius: 8px;
}
.date-group-label { font-size: 14px; font-weight: 700; color: #4A4A4A; }
.date-group-count { font-size: 11px; color: var(--text-sub); background: #F0EDE8; padding: 2px 8px; border-radius: 8px; }

/* ─── 日期列 ─── */
.cell-date { font-size: 12px; color: var(--text-sub); white-space: nowrap; }

/* ─── 移动端日期头部 ─── */
.card-date-header {
  font-size: 13px; font-weight: 700; color: #4A4A4A; padding: 8px 12px;
  background: linear-gradient(135deg, #FDFBF7, #F9F6F0);
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
</style>
