<script setup>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWizardCStore } from '@/stores/wizardC'
import { storage, getQueryParam } from '@/utils/storage'
import { calculateShootingDuration, resolveTimingParams, checkTimeConflict } from '@/utils/durationCalc'
import { normalizeExtraItems, getExtraItemKey, getExtraUnitLabel, getExtraItemAmount } from '@/utils/extraItems'
import FlexibleTimelinePicker from '@/components/client/FlexibleTimelinePicker.vue'

const route = useRoute()
const router = useRouter()
const wizardC = useWizardCStore()

const studioId = computed(() => parseInt(route.params.studioId))
const mId = computed(() => getQueryParam('mId') || route.query.mId || storage.get('mzg_client_mid', ''))

const DEVICE_ID = computed(() => {
  let id = storage.get('mzg_device_id', '')
  if (!id) { id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); storage.set('mzg_device_id', id) }
  return id
})

// ── 项目 ──
const studio = ref(null)
const loading = ref(true)
const errorMsg = ref('')

// ── 样式 ──
const selectedStyleId = ref(wizardC.selectedStyleId || null)
const selectedPackageId = ref(null)   // 选中的套餐 ID（模式 B）
const bookingMode = ref('single')     // 'single' | 'package'

const availableStyles = computed(() => {
  if (!studio.value?.isStyleEnabled) return []
  return studio.value.styles || []
})
const selectedStyle = computed(() =>
  availableStyles.value.find(s => s.id === selectedStyleId.value) || null
)
const selectedPackage = computed(() => {
  if (bookingMode.value !== 'package' || !selectedStyle.value) return null
  return (selectedStyle.value.packages || []).find(p => p.id === selectedPackageId.value) || null
})

// 重置套餐选择
function resetPackageSelection() {
  selectedPackageId.value = null
  bookingMode.value = 'single'
}

// ── 日期 ──
const selectedDate = ref(wizardC.bookingDate || '')
const today = new Date().toISOString().slice(0, 10)

//   从可选日期列表中筛选（若为空数组则允许所有日期）
const availableDateSet = computed(() => {
  const dates = studio.value?.availableDates
  if (!dates || !Array.isArray(dates) || dates.length === 0) return null
  return new Set(dates)
})
const dateOutOfRange = computed(() => {
  if (!selectedDate.value || !availableDateSet.value) return false
  return !availableDateSet.value.has(selectedDate.value)
})

function formatWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[d.getDay()] || ''
}

function selectDateCard(d) {
  if (d < today) return
  selectedDate.value = d
  startTime.value = ''
}

// ── 可用性 ──
const bookedRanges = ref([])
const restRanges = ref([])
const baseStartTime = ref('09:00')
const baseEndTime = ref('18:00')

// ── 服务配置 ──
const optType = ref(wizardC.pricingType || 'single')
const photoCount = ref(wizardC.quantity || 1)
const modelExperience = ref(wizardC.modelExperience || 'experienced')
const startTime = ref(wizardC.startTime || '')
const selectedAddonIds = ref([...wizardC.selectedAddonIds])

// ── 辅助函数 ──
function toMin(t) { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m }
function toTime(m) { const h = Math.floor(m / 60) % 24, mm = m % 60; return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0') }
// ── 有效单价 / 总价 ──
const effectiveUnitPrice = computed(() => {
  if (selectedStyle.value) {
    return optType.value === 'single' ? (selectedStyle.value.singlePrice || 0) : (selectedStyle.value.packagePrice || 0)
  }
  return optType.value === 'single' ? (studio.value?.singlePrice || 0) : (studio.value?.packagePrice || 0)
})

//   有效张数（套餐模式锁定为套餐包含张数）
const effectivePhotoCount = computed(() => {
  if (bookingMode.value === 'package' && selectedPackage.value) {
    return selectedPackage.value.photoCount
  }
  return photoCount.value
})

// ── 耗时（使用纯函数 calculateShootingDuration）──
const timingParams = computed(() => {
  // 套餐模式：直接使用套餐固定耗时
  if (bookingMode.value === 'package' && selectedPackage.value) {
    return {
      timePerPhoto: selectedPackage.value.fixedDuration,
      noviceExtraTime: 0,
      restTime: studio.value?.intervalRestTime || 0,
    }
  }
  return resolveTimingParams(optType.value, studio.value, selectedStyle.value)
})

const durationResult = computed(() =>
  calculateShootingDuration({
    photoCount: bookingMode.value === 'package' ? 1 : effectivePhotoCount.value,
    timePerPhoto: timingParams.value.timePerPhoto,
    isNovice: modelExperience.value === 'newcomer',
    noviceExtraTime: timingParams.value.noviceExtraTime,
    restTime: timingParams.value.restTime,
  })
)

// ── 双时间层：展示层 vs 占用层 ──
// 展示层（用户可见）：仅纯拍摄时间，不含休息
const displayDuration = computed(() => durationResult.value.actualShootingTime)
const displayEndTime = computed(() => {
  if (!startTime.value) return ''
  return toTime(toMin(startTime.value) + displayDuration.value)
})

// 占用层（系统排期）：拍摄 + 休息 = 完整 block
const blockedDuration = computed(() => durationResult.value.totalBlockedTime)
const blockedEndTime = computed(() => {
  if (!startTime.value) return ''
  return toTime(toMin(startTime.value) + blockedDuration.value)
})

const noviceAdd = computed(() => timingParams.value.noviceExtraTime)

// 兼容旧引用 (FlexibleTimelinePicker 需要包含休息时间做碰撞检测)
const totalDuration = computed(() => blockedDuration.value)
const computedEndTime = computed(() => blockedEndTime.value)

// ── 将已预约 + 休息时段合并为统一不可用列表 ──
//    注意: 对客户隐藏 "休息" 概念，统一显示为不可选时段
const unifiedUnavailable = computed(() => {
  const slots = []
  for (const b of bookedRanges.value) {
    slots.push({ start: b.start, end: b.end, type: 'booked', lockType: b.lockType, reason: b.lockType === 'hard_lock' ? '已确认' : '预锁' })
  }
  for (const r of restRanges.value) {
    // 后台休息时段统一按 "已被预约" 渲染，不暴露 "休息" 标签
    slots.push({ start: r.start, end: r.end, type: 'booked', reason: '时段占用' })
  }
  return slots
})

// ── 附加项目 ──
// 优先从已选样式中读取，其次从工作室/项目配置中读取
const availableExtraItems = computed(() => {
  let items = []
  if (selectedStyle.value) {
    items = normalizeExtraItems(selectedStyle.value)
  }
  if (items.length === 0 && studio.value) {
    items = normalizeExtraItems(studio.value)
  }
  return items
})

const selectedExtraItemKeys = computed(() => {
  return availableExtraItems.value.map((item, idx) => getExtraItemKey(item, idx))
})

const selectedExtraItems = computed(() => {
  return availableExtraItems.value.filter((item, idx) => {
    return selectedAddonIds.value.includes(getExtraItemKey(item, idx))
  })
})

function toggleAddon(item, index) {
  const key = getExtraItemKey(item, index)
  const idx = selectedAddonIds.value.indexOf(key)
  if (idx >= 0) {
    selectedAddonIds.value.splice(idx, 1)
  } else {
    selectedAddonIds.value.push(key)
  }
}

const addonTotal = computed(() => {
  let total = 0
  const ctx = { photoCount: effectivePhotoCount.value }
  for (const id of selectedAddonIds.value) {
    const item = availableExtraItems.value.find((a, i) =>
      getExtraItemKey(a, i) === String(id)
    )
    if (item) total += getExtraItemAmount(item, ctx)
  }
  return total
})

// ── 价格（套餐模式用固定总价）──
const computedPrice = computed(() => {
  let base = 0
  if (bookingMode.value === 'package' && selectedPackage.value) {
    base = selectedPackage.value.totalPrice
  } else {
    base = effectiveUnitPrice.value * effectivePhotoCount.value
  }
  return base + addonTotal.value
})
const depositAmount = computed(() =>
  Math.round(computedPrice.value * (studio.value?.depositRatio || 30) / 100 * 100) / 100
)

// ── 碰撞检测（使用 checkTimeConflict 纯函数）──
const conflictResult = computed(() => {
  if (!startTime.value || !computedEndTime.value) {
    return { hasConflict: false, message: '', conflicts: [] }
  }
  const sMin = toMin(startTime.value)
  const eMin = toMin(computedEndTime.value)
  const bsMin = toMin(baseStartTime.value)
  const beMin = toMin(baseEndTime.value)

  // 先校验营业时间边界
  if (sMin < bsMin) return { hasConflict: true, message: `起始时间早于营业时间 ${baseStartTime.value}`, conflicts: [] }
  if (eMin > beMin) return { hasConflict: true, message: `预计结束 ${computedEndTime.value} 超出营业时间 ${baseEndTime.value}`, conflicts: [] }

  // 再调用纯函数检测与已有不可用时段的冲突
  const result = checkTimeConflict(
    { start: startTime.value, end: computedEndTime.value },
    unifiedUnavailable.value,
  )

  return result
})

const conflictMsg = computed(() => conflictResult.value.message)
const hasConflict = computed(() => conflictResult.value.hasConflict)

const canProceed = computed(() => {
  if (!selectedDate.value || dateOutOfRange.value) return false
  if (!startTime.value || !computedEndTime.value || hasConflict.value || effectivePhotoCount.value <= 0) return false
  if (studio.value?.isStyleEnabled && availableStyles.value.length > 0 && !selectedStyleId.value) return false
  // 样式有套餐但未选择套餐或按张 → 允许（按张模式默认生效）
  if (bookingMode.value === 'package' && !selectedPackageId.value) return false
  return true
})

// ── 加载 ──
async function fetchStudioData() {
  if (!mId.value) {
    // ★ mId 缺失时，先通过全量列表反查工作室的 mId
    const allRes = await fetch('/api/studios-lite').then(r => r.json())
    const list = (allRes.data || allRes) || []
    const match = list.find(s => String(s.id) === String(studioId.value))
    if (match && match.mId) {
      storage.set('mzg_client_mid', match.mId)
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.set('mId', match.mId)
      window.history.replaceState({}, '', newUrl.toString())
      studio.value = match
      if (match?.availableDates?.length === 1) {
        selectedDate.value = match.availableDates[0]
      }
      return
    }
    errorMsg.value = '缺少商家ID，请从正确的下单链接进入'; return
  }
  storage.set('mzg_client_mid', mId.value)
  const res = await fetch(`/api/studios-lite?mId=${mId.value}`).then(r => r.json())
  const list = (res.data || res) || []
  const found = list.find(s => String(s.id) === String(studioId.value))
  if (!found) { errorMsg.value = '项目不存在或已下架'; loading.value = false; return }
  studio.value = found
  // 若只有一个可选日期，自动选中
  if (found?.availableDates?.length === 1) {
    selectedDate.value = found.availableDates[0]
  }
}

async function fetchAvailability() {
  const d = selectedDate.value
  if (!d || !mId.value) return
  const res = await fetch(`/api/booked-times-v2?mId=${mId.value}&studioId=${studioId.value}&date=${d}`).then(r => r.json())
  const data = (res.data || res)
  bookedRanges.value = data.bookedRanges || []
  restRanges.value = data.restRanges || []
  baseStartTime.value = data.baseStartTime || studio.value?.baseStartTime || '09:00'
  baseEndTime.value = data.baseEndTime || studio.value?.baseEndTime || '18:00'
  startTime.value = ''
}

// ★ 轮询时间轴：每 10s 自动刷新，确保商家取消/删除订单后客户端实时释放时段
let pollTimer = null

onMounted(async () => {
  // ★ mId 校验改由 fetchStudioData 内部容错（通过全量列表反查补全）
  try {
    await fetchStudioData()
  } catch { errorMsg.value = '加载失败' }
  loading.value = false
  // 启动 10s 轮询
  pollTimer = setInterval(() => {
    if (selectedDate.value && document.visibilityState !== 'hidden') {
      fetchAvailability().catch(() => {})
    }
  }, 10000)
})

onUnmounted(() => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
})

watch(selectedDate, async (d) => {
  if (!d) return
  try { await fetchAvailability() } catch { bookedRanges.value = []; restRanges.value = [] }
})

// ── 监听刷新总线 ──
const refreshBus = inject('refreshBus', null)
watch(() => refreshBus?.tick, async (newTick) => {
  if (!newTick || newTick <= 0) return
  try {
    await fetchStudioData()
    await fetchAvailability()
  } catch { /* 静默 — RefreshButton 本身有超时机制 */ }
})

// ── 切换样式时重置套餐选择和附加项目 ──
watch(selectedStyleId, () => {
  resetPackageSelection()
  selectedAddonIds.value = []
})

// ── 附加项目列表变化时清空已选（防止跨项目/跨样式脏数据）──
watch(availableExtraItems, () => {
  selectedAddonIds.value = []
})

function goNext() {
  if (!canProceed.value) return
  wizardC.setStep1({
    studioId: studioId.value, bookingDate: selectedDate.value,
    pricingType: optType.value, quantity: photoCount.value,
    isNewCustomer: modelExperience.value === 'newcomer',
    startTime: startTime.value,
    endTime: displayEndTime.value,
    blockedEndTime: blockedEndTime.value,
    totalMin: blockedDuration.value,
    displayMin: displayDuration.value,
    price: computedPrice.value,
    selectedStyleId: selectedStyleId.value,
    selectedPackageId: bookingMode.value === 'package' ? selectedPackageId.value : null,
    styleName: selectedStyle.value?.styleName || '',
    modelExperience: modelExperience.value,
    depositRatio: studio.value?.depositRatio || 30,
    packageFixedDuration: selectedPackage.value?.fixedDuration || 0,
    selectedAddonIds: [...selectedAddonIds.value],
    addonTotal: addonTotal.value,
    selectedExtraItems: selectedExtraItems.value.map((item, idx) => {
      const src = availableExtraItems.value.find((a, i) => getExtraItemKey(a, i) === getExtraItemKey(item, idx))
      return {
        name: item.name,
        price: Number(item.price || 0),
        unit: item.unit || 'per_time',
        unitLabel: getExtraUnitLabel(item.unit),
        amount: getExtraItemAmount(item, { photoCount: effectivePhotoCount.value }),
      }
    }),
  })
  router.push(`/booking/${studioId.value}/step2?mId=${mId.value}`)
}
</script>

<template>
  <div class="c-step1 fade-in-up" style="max-width:520px;margin:0 auto;padding:0 0 30px;">
    <div v-if="loading" style="text-align:center;padding:60px 20px;color:var(--text-sub);">加载中...</div>
    <div v-else-if="errorMsg" style="text-align:center;padding:60px 20px;color:var(--danger,#c98a8a);">{{ errorMsg }}</div>

    <template v-else>
      <!-- 项目信息 -->
      <div class="section">
        <div class="section-title">{{ studio?.title || '项目详情' }}</div>
        <p v-if="studio?.description" style="font-size:12px;color:var(--text-sub);margin-top:4px;">{{ studio.description }}</p>
        <div style="display:flex;gap:12px;margin-top:6px;font-size:12px;color:var(--text-sub);">
          <span v-if="studio?.city">{{ studio.city }}</span>
          <span>{{ studio?.baseStartTime || '09:00' }}—{{ studio?.baseEndTime || '18:00' }}</span>
        </div>
      </div>

      <!-- ★ SKU分流器：样式卡片流 -->
      <div v-if="availableStyles.length > 0">
        <div class="section-header">选择样式 <span style="color:var(--danger,#c98a8a);font-size:11px;">*</span></div>
        <div
          v-for="s in availableStyles" :key="s.id"
          :class="['style-card', { selected: selectedStyleId === s.id }]"
          @click="selectedStyleId = selectedStyleId === s.id ? null : s.id"
        >
          <img v-if="s.styleCoverUrl" :src="s.styleCoverUrl" class="style-img" />
          <div v-else class="style-placeholder">🎨</div>
          <div class="style-body">
            <div class="style-name">{{ s.styleName }}</div>
            <div class="style-meta">
              ¥{{ s.singlePrice || 0 }}/张 · {{ studio?.singleShotTime || 60 }}min
              <span v-if="s.hasPackage" class="style-pkg">套餐 ¥{{ s.packagePrice }} · {{ studio?.packageTime || 120 }}min</span>
            </div>
          </div>
          <span v-if="selectedStyleId === s.id" class="style-check">✓</span>
        </div>
      </div>

      <!-- ★ 套餐选择（选中样式后展示） -->
      <div v-if="selectedStyle && selectedStyle.packages && selectedStyle.packages.length > 0" class="section">
        <div class="section-title">
          选择购买方式
          <span class="section-badge">{{ selectedStyle.packages.length }} 个套餐可选</span>
        </div>

        <!-- 横向滚动套餐卡片 -->
        <div class="pkg-scroll">
          <button
            v-for="pkg in selectedStyle.packages"
            :key="pkg.id"
            :class="['pkg-card', { active: bookingMode === 'package' && selectedPackageId === pkg.id }]"
            @click="bookingMode = 'package'; selectedPackageId = pkg.id"
          >
            <div class="pkg-card-top">
              <span class="pkg-card-name">{{ pkg.name }}</span>
              <span v-if="bookingMode === 'package' && selectedPackageId === pkg.id" class="pkg-card-check">✓</span>
            </div>
            <div class="pkg-card-price">¥{{ pkg.totalPrice }}</div>
            <div class="pkg-card-meta">
              <span>{{ pkg.photoCount }} 张</span>
              <span class="pkg-card-sep">·</span>
              <span>{{ pkg.fixedDuration }} min</span>
            </div>
            <div v-if="pkg.description" class="pkg-card-desc">{{ pkg.description }}</div>
          </button>

          <!-- 按单张计费 -->
          <button
            :class="['pkg-card', 'pkg-single', { active: bookingMode === 'single' }]"
            @click="resetPackageSelection()"
          >
            <div class="pkg-card-top">
              <span class="pkg-card-name">按单张计费</span>
              <span v-if="bookingMode === 'single'" class="pkg-card-check">✓</span>
            </div>
            <div class="pkg-card-price">¥{{ selectedStyle.singlePrice || 0 }}<span class="pkg-per">/张</span></div>
            <div class="pkg-card-meta">自选拍摄张数</div>
          </button>
        </div>
      </div>

      <!-- 日期 -->
      <div class="section">
        <div class="section-title">选择日期</div>

        <!-- 有特定可选日期时：用卡片式日期选择器替代原生 input -->
        <template v-if="availableDateSet">
          <div v-if="studio.availableDates.length === 0" class="hint-warn">
            该项目暂未设置可选日期，请稍后再试或联系商家
          </div>
          <div v-else class="date-grid">
            <button
              v-for="d in studio.availableDates"
              :key="d"
              :class="['date-card', { active: selectedDate === d, past: d < today }]"
              :disabled="d < today"
              @click="selectDateCard(d)"
            >
              <span class="date-weekday">{{ formatWeekday(d) }}</span>
              <span class="date-day">{{ d.slice(8) }}</span>
              <span class="date-month">{{ d.slice(5, 7) }}月</span>
            </button>
          </div>
          <div v-if="selectedDate && dateOutOfRange" class="hint-warn" style="margin-top:8px;">
            请从下方可选日期中选择
          </div>
        </template>

        <!-- 全时段模式：原生日期选择器 -->
        <template v-else>
          <input type="date" v-model="selectedDate" :min="today" class="input-field" style="width:100%;" />
        </template>
      </div>

      <!-- 服务类型（套餐模式锁定张数） -->
      <div class="section">
        <div class="section-title">
          服务类型
          <span v-if="bookingMode === 'package'" class="pkg-locked-badge">套餐锁定</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <select v-model="optType" class="input-field" style="width:auto;">
            <option value="single">单张</option>
            <option v-if="studio?.hasPackage || studio?.packagePrice || (selectedStyle?.hasPackage)" value="package">套餐</option>
          </select>
          <span style="font-size:13px;color:var(--text-sub);">×</span>
          <input
            type="number"
            :value="effectivePhotoCount"
            :min="1"
            :max="99"
            :disabled="bookingMode === 'package'"
            class="input-field"
            :class="{ locked: bookingMode === 'package' }"
            style="width:70px;"
            @input="e => { if (bookingMode !== 'package') photoCount = Number(e.target.value) }"
          />
          <span style="font-size:13px;color:var(--text-sub);">{{ optType === 'single' ? '张' : '套' }}</span>
          <span style="font-size:12px;color:var(--text-sub);">单价 ¥{{ effectiveUnitPrice }}</span>
        </div>
      </div>

      <!-- 附加项目 -->
      <div v-if="availableExtraItems.length > 0" class="section">
        <div class="section-title">附加项目</div>
        <div v-for="(item, idx) in availableExtraItems" :key="getExtraItemKey(item, idx)" class="addon-row" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--line,#e8e5df);border-radius:10px;margin-bottom:6px;cursor:pointer;" :class="{ 'addon-selected': selectedAddonIds.includes(getExtraItemKey(item, idx)) }" @click="toggleAddon(item, idx)">
          <span style="width:20px;height:20px;border-radius:6px;border:2px solid var(--line,#d0ccc4);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:#fff;transition:all .2s;" :style="selectedAddonIds.includes(getExtraItemKey(item, idx)) ? 'background:var(--accent,#c9a0a0);border-color:var(--accent,#c9a0a0);' : ''">{{ selectedAddonIds.includes(getExtraItemKey(item, idx)) ? '✓' : '' }}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text-main);flex:1;">{{ item.name }}</span>
          <span style="font-size:12px;color:var(--text-sub);">+¥{{ item.price }} {{ getExtraUnitLabel(item.unit) }}</span>
        </div>
        <div v-if="addonTotal > 0" style="text-align:right;font-size:12px;color:var(--accent,#c9a0a0);margin-top:6px;">附加合计 +¥{{ addonTotal }}</div>
      </div>

      <!-- 模特经验 -->
      <div class="section" v-if="studio?.isExperienceEnabled">
        <div class="section-title">模特经验</div>
        <div style="display:flex;gap:16px;">
          <label class="radio-label">
            <input type="radio" v-model="modelExperience" value="experienced" /> 老手
          </label>
          <label class="radio-label">
            <input type="radio" v-model="modelExperience" value="newcomer" /> 新人
            <span v-if="noviceAdd" class="addon-tag">+{{ noviceAdd }}min</span>
          </label>
        </div>
      </div>

      <!-- ★ FlexibleTimelinePicker 时间轴选择器 -->
      <div class="section" v-if="selectedDate">
        <div class="section-title">
          选择起始时间
          <span style="font-size:11px;color:var(--text-sub);font-weight:400;">(需 {{ totalDuration }}min)</span>
        </div>
        <FlexibleTimelinePicker
          :open-time="baseStartTime"
          :close-time="baseEndTime"
          :unavailable-slots="unifiedUnavailable"
          :required-duration="totalDuration"
          :selected-start-time="startTime"
          :step="1"
          @update:selected-start-time="startTime = $event"
          @select="startTime = $event"
        />
      </div>

      <!-- ★ 毛玻璃预计拍摄看板（仅展示纯拍摄时间，不暴露休息时间） -->
      <div class="preview-panel" v-if="selectedDate">
        <div v-if="!startTime" class="preview-hint">请先选择起始时间，系统将自动推算拍摄区间</div>
        <template v-else>
          <div class="preview-label">预计拍摄时间段</div>
          <div class="preview-range">
            <div class="preview-time">
              <span class="preview-time-label">开始</span>
              <span class="preview-time-value start">{{ startTime }}</span>
            </div>
            <span class="preview-arrow">→</span>
            <div class="preview-time">
              <span class="preview-time-label">结束</span>
              <span class="preview-time-value end">{{ displayEndTime }}</span>
            </div>
          </div>
          <div class="preview-detail">预计拍摄 <strong>{{ displayDuration }}</strong> 分钟</div>
        </template>
      </div>

      <!-- 冲突 -->
      <div v-if="hasConflict" class="conflict-bar">
        <div class="conflict-main">
          <i class="fa-solid fa-triangle-exclamation"></i>
          您选择的起始时间加上拍摄总耗时后，会与已有的时间段冲突，请重新选择更早的起始时间或减少拍摄张数。
        </div>
        <div v-if="conflictMsg" class="conflict-detail">{{ conflictMsg }}</div>
      </div>

      <!-- 价格 & 下一步 -->
      <div class="price-summary">
        预估: ¥{{ computedPrice }}
        <span class="deposit-note"> · 定金 ¥{{ depositAmount }}</span>
      </div>

      <div style="padding:0 14px 20px;display:flex;gap:10px;">
        <button class="btn-secondary" @click="router.push('/studios')" style="flex:1;">← 返回</button>
        <button class="btn-primary" :disabled="!canProceed" @click="goNext" style="flex:2;">下一步 →</button>
      </div>
    </template>
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
.section-header {
  font-size: 14px; font-weight: 700;
  padding: 0 14px; margin-top: 10px; margin-bottom: 4px;
}
.input-field {
  padding: 10px 14px; border: 1px solid #E8E5DF; border-radius: 12px;
  font-size: 14px; outline: none; background: #fff;
}
.input-field:focus { border-color: #F4A460; box-shadow: 0 0 0 3px rgba(244,164,96,.12); }

/* ─── 样式卡片 ─── */
.style-card {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; margin: 6px 14px; border-radius: 14px; cursor: pointer;
  background: rgba(255,255,255,0.72); border: 1.5px solid rgba(180,185,182,0.18);
  transition: all .2s; backdrop-filter: blur(12px);
}
.style-card:hover { border-color: var(--purple, #5a7a65); }
.style-card.selected {
  border-color: var(--purple, #5a7a65);
  box-shadow: 0 4px 16px rgba(125,158,138,0.2);
  background: rgba(232,240,235,0.4);
}
.style-img { width: 52px; height: 52px; object-fit: cover; border-radius: 10px; flex-shrink: 0; }
.style-placeholder {
  width: 52px; height: 52px; border-radius: 10px; flex-shrink: 0;
  background: var(--purple-light, #e8f0eb);
  display: flex; align-items: center; justify-content: center; font-size: 22px;
}
.style-body { flex: 1; min-width: 0; }
.style-name { font-size: 14px; font-weight: 700; }
.style-meta { font-size: 12px; color: var(--text-sub, #8e8ea0); margin-top: 2px; }
.style-pkg { color: var(--purple, #5a7a65); }
.style-check { color: var(--purple, #5a7a65); font-size: 20px; flex-shrink: 0; }

/* ─── 单选 ─── */
.radio-label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px; }
.addon-tag { font-size: 11px; color: var(--peach, #8a7040); }

/* ─── 毛玻璃看板 ─── */
.preview-panel {
  margin: 10px 14px; padding: 20px 18px; text-align: center;
  background: linear-gradient(135deg, rgba(255,255,255,0.85), rgba(240,245,242,0.85), rgba(238,242,245,0.85));
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(180,195,190,0.3); border-radius: 20px;
  animation: breathe 2.5s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(123,168,130,0.15); }
  50% { box-shadow: 0 0 0 8px rgba(123,168,130,0); }
}
.preview-hint { color: var(--text-sub, #8e8ea0); padding: 12px; font-size: 13px; }
.preview-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--text-sub, #8e8ea0); margin-bottom: 8px; }
.preview-range { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 8px 0; }
.preview-time { text-align: center; }
.preview-time-label { font-size: 10px; color: var(--text-sub, #8e8ea0); display: block; }
.preview-time-value { font-size: 28px; font-weight: 800; font-family: 'SF Mono', monospace; }
.preview-time-value.start { color: var(--color-primary-dark, #5a7a65); }
.preview-time-value.end { color: var(--sakura, #a08080); }
.preview-arrow { font-size: 24px; color: var(--color-primary-light, #a8bfad); }
.preview-detail { font-size: 13px; color: var(--text-secondary, #6e6e73); margin-top: 4px; }

/* ─── 冲突 ─── */
.conflict-bar {
  margin: 0 14px; padding: 12px 14px; border-radius: 10px;
  background: rgba(201,138,138,0.08); font-size: 13px;
}
.conflict-main {
  color: #a05050; font-weight: 500; line-height: 1.5;
}
.conflict-detail {
  margin-top: 4px; font-size: 12px; color: #b87070;
  padding: 4px 10px; background: rgba(201,138,138,0.06); border-radius: 6px;
}

/* ─── 价格 ─── */
.price-summary {
  text-align: center; margin: 12px 0; font-size: 20px; font-weight: 800;
  color: var(--color-primary-dark, #5a7a65);
}
.deposit-note { font-size: 12px; color: var(--text-sub, #8e8ea0); font-weight: 400; }

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

/* ─── 日期范围提示 ─── */
.hint-warn {
  margin-top: 6px; font-size: 12px; color: #D4893E;
  padding: 6px 10px; background: #FEF7EF; border-radius: 8px;
}

/* ─── 套餐卡片 ─── */
.section-badge {
  font-size: 10px; font-weight: 600; color: #D4893E;
  background: #FEF7EF; padding: 2px 8px; border-radius: 10px;
  margin-left: 8px; vertical-align: middle;
}
.pkg-scroll {
  display: flex; gap: 10px; overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}
.pkg-scroll::-webkit-scrollbar { height: 0; }

.pkg-card {
  flex: 0 0 auto; width: 160px; scroll-snap-align: start;
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px 12px; border-radius: 14px; cursor: pointer;
  border: 2px solid #E8E5DF; background: #fff;
  transition: all 0.2s; font-family: inherit; text-align: left;
  -webkit-tap-highlight-color: transparent;
}
.pkg-card:hover:not(.active) { border-color: #F4A460; background: #FFFCF7; }
.pkg-card.active {
  border-color: #F4A460;
  background: linear-gradient(160deg, #FFF5E8 0%, #FEF7EF 100%);
  box-shadow: 0 4px 16px rgba(244,164,96,0.15);
  transform: translateY(-2px);
}
.pkg-card.pkg-single {
  border-style: dashed; border-color: #D0D0D0; background: #FAFAFA;
}
.pkg-card.pkg-single.active {
  border-style: solid; border-color: #7A9A86;
  background: linear-gradient(160deg, #EDF6F0 0%, #F4F9F5 100%);
  box-shadow: 0 4px 16px rgba(122,154,134,0.12);
}

.pkg-card-top {
  display: flex; justify-content: space-between; align-items: flex-start;
}
.pkg-card-name { font-size: 14px; font-weight: 700; color: #3A3A4A; line-height: 1.3; }
.pkg-card-check {
  font-size: 14px; font-weight: 700; color: #F4A460;
  flex-shrink: 0; margin-left: 6px;
}
.pkg-card.active.pkg-single .pkg-card-check { color: #5A8A6A; }

.pkg-card-price {
  font-size: 22px; font-weight: 800; color: #D4893E;
  line-height: 1.2; margin: 2px 0;
}
.pkg-card.pkg-single .pkg-card-price { color: #5A8A6A; }
.pkg-per { font-size: 12px; font-weight: 500; color: #8E8E8E; }

.pkg-card-meta { font-size: 11px; color: #8E8E8E; }
.pkg-card-sep { margin: 0 3px; color: #D0D0D0; }
.pkg-card-desc { font-size: 10px; color: #B0B0B0; line-height: 1.4; margin-top: 2px; }

.pkg-locked-badge {
  display: inline-block; font-size: 10px; font-weight: 600;
  padding: 2px 8px; border-radius: 10px;
  background: #FEF7EF; color: #D4893E;
  margin-left: 6px; vertical-align: middle;
}
.input-field.locked {
  background: #F4F2EE; color: #B0B0B0; cursor: not-allowed;
}

/* ─── 日期卡片网格 ─── */
.date-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;
}
.date-card {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 10px 6px; border-radius: 14px; cursor: pointer;
  border: 1.5px solid #E8E5DF; background: #fff;
  transition: all 0.15s; font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}
.date-card:hover:not(:disabled):not(.active) {
  border-color: #F4A460; background: #FEF7EF;
}
.date-card:disabled { cursor: not-allowed; opacity: .38; }
.date-card.past { opacity: .38; cursor: not-allowed; }
.date-card.active {
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  border-color: #F4A460; color: #fff;
  box-shadow: 0 4px 16px rgba(244,164,96,0.25);
}
.date-card.active .date-weekday,
.date-card.active .date-month { color: rgba(255,255,255,0.8); }
.date-card.active .date-day { color: #fff; }
.date-weekday { font-size: 11px; color: #8E8E8E; font-weight: 500; }
.date-day { font-size: 20px; font-weight: 800; color: #3A3A4A; line-height: 1; }
.date-month { font-size: 10px; color: #B0B0B0; font-weight: 500; }
</style>
