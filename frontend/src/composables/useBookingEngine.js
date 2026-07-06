/**
 * useBookingEngine — 纯逻辑预约引擎（Headless Composable）
 *
 * 设计目标:
 *   - 零 DOM 依赖，可完整复制到微信小程序 JS 文件中运行
 *   - 与后端 TimeBlockCalculator 公式完全一致，保证前后端时间计算同源
 *   - 所有状态流转与校验逻辑从此文件单向导出，UI 层仅做渲染
 *
 * 移植指南:
 *   将 Vue 的 ref / computed 替换为小程序的响应式等价物即可，
 *   核心纯函数 (computeTimeBlock / checkConflict) 可直接使用。
 *
 * 使用示例:
 *   const {
 *     optType, photoCount, modelExperience, startTime,
 *     computedTimeBlock, conflictValidation, computedPrice,
 *     resetForm, canProceed,
 *   } = useBookingEngine(studioConfig, availability)
 */

import { ref, computed, unref } from 'vue'
import { calculateShootingDuration, checkTimeConflict } from '@/utils/durationCalc'

// ==============================================================
// 纯函数区 — 零外部依赖，可直接复制到任何 JS 运行环境
// ==============================================================

/**
 * 将 "HH:mm" 字符串转为从 0:00 开始的分钟数
 * @param {string} time - e.g. "09:30"
 * @returns {number} 分钟数
 */
function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return 0
  const parts = time.split(':')
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
}

/**
 * 将分钟数转为 "HH:mm" 字符串（支持跨天回卷）
 * @param {number} totalMinutes
 * @returns {string}
 */
function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 核心时间块精算（纯函数，与后端公式一致）
 *
 * 公式:
 *   TotalDuration = sessionCount × durationPerSession
 *                 + (sessionCount - 1) × restInterval
 *                 + newCustomerExtra
 *
 * @param {Object} params
 * @param {'single'|'package'} params.pricingType
 * @param {number}  params.count          - 张数或套餐数
 * @param {boolean} params.isNewCustomer
 * @param {string}  params.startTime      - "HH:mm"
 * @param {Object}  params.rules          - 耗时规则
 * @param {number}  params.rules.singleDuration
 * @param {number}  params.rules.sessionDuration
 * @param {number}  params.rules.restInterval
 * @param {number}  params.rules.newCustomerExtra
 * @param {number}  [params.rules.packageSessionCount] - 套餐内次数
 * @returns {{ startTime: string, endTime: string, totalMinutes: number, sessionCount: number, segments: Array }}
 */
function computeTimeBlock({ pricingType, count, isNewCustomer, startTime, rules }) {
  const singleDuration   = rules.singleDuration   ?? 60
  const sessionDuration  = rules.sessionDuration  ?? 60
  const restInterval     = rules.restInterval     ?? 0
  const newCustomerExtra = rules.newCustomerExtra ?? 0
  const pkgSessionCount  = rules.packageSessionCount ?? 1

  // 确定实际拍摄次数与单次耗时
  let sessionCount
  let durationPerSession

  if (pricingType === 'single') {
    sessionCount = count
    durationPerSession = singleDuration
  } else {
    sessionCount = count * pkgSessionCount
    durationPerSession = sessionDuration
  }

  // 防止无意义输入
  if (sessionCount <= 0 || durationPerSession <= 0) {
    return {
      startTime,
      endTime: startTime || '--:--',
      totalMinutes: 0,
      sessionCount: 0,
      segments: [],
    }
  }

  const shootMinutes     = sessionCount * durationPerSession
  const restMinutes      = Math.max(0, sessionCount - 1) * restInterval
  const extraMinutes     = isNewCustomer ? newCustomerExtra : 0
  const totalMinutes     = shootMinutes + restMinutes + extraMinutes

  const startMin = timeToMinutes(startTime)
  const endMin   = startMin + totalMinutes
  const endTime  = minutesToTime(endMin)

  // 构建时段明细
  const segments = []
  let cursor = startMin

  for (let i = 0; i < sessionCount; i++) {
    if (i === 0 && isNewCustomer && newCustomerExtra > 0) {
      const extraStart = cursor
      cursor += newCustomerExtra
      segments.push({ start: minutesToTime(extraStart), end: minutesToTime(cursor), type: 'new_customer_extra' })
    }

    const segStart = cursor
    cursor += durationPerSession
    segments.push({ start: minutesToTime(segStart), end: minutesToTime(cursor), type: 'shoot' })

    if (i < sessionCount - 1 && restInterval > 0) {
      const restStart = cursor
      cursor += restInterval
      segments.push({ start: minutesToTime(restStart), end: minutesToTime(cursor), type: 'rest' })
    }
  }

  return {
    startTime,
    endTime,
    totalMinutes,
    sessionCount,
    segments,
  }
}

/**
 * 客户端冲突预校验（纯函数）
 *
 * 检测项:
 *   1. 起始时间是否在营业时间之前
 *   2. 结束时间是否超出营业时间
 *   3. 时间段是否与休息段重叠
 *
 * @param {Object} params
 * @param {string} params.startTime  - "HH:mm"
 * @param {string} params.endTime    - "HH:mm"
 * @param {string} params.openTime   - 营业开始 "HH:mm"
 * @param {string} params.closeTime  - 营业结束 "HH:mm"
 * @param {Array<{start_time:string,end_time:string}>} params.restSlots
 * @returns {{ valid: boolean, errors: Array<{code: string, message: string}> }}
 */
function checkConflict({ startTime, endTime, openTime, closeTime, restSlots }) {
  const errors = []

  if (!startTime || !endTime) {
    return { valid: false, errors: [{ code: 'EMPTY_TIME', message: '请选择起始时间' }] }
  }

  const startMin = timeToMinutes(startTime)
  const endMin   = timeToMinutes(endTime)
  const openMin  = timeToMinutes(openTime)
  const closeMin = timeToMinutes(closeTime)

  // 1. 起始早于营业
  if (startMin < openMin) {
    errors.push({ code: 'START_BEFORE_OPEN', message: `起始时间早于营业时间 ${openTime}` })
  }

  // 2. 结束晚于营业（允许 start 在营业范围内而 end 跨天时，按 >24h 处理）
  if (endMin > closeMin) {
    errors.push({ code: 'END_AFTER_CLOSE', message: `预计结束 ${endTime} 超出营业时间 ${closeTime}` })
  }

  // 3. 与休息段重叠
  if (restSlots && restSlots.length > 0) {
    for (const slot of restSlots) {
      const restStart = timeToMinutes(slot.start_time)
      const restEnd   = timeToMinutes(slot.end_time)
      if (startMin < restEnd && endMin > restStart) {
        errors.push({
          code: 'REST_SLOT_OVERLAP',
          message: `时段与休息段 ${slot.start_time}-${slot.end_time}${slot.reason ? `(${slot.reason})` : ''} 重叠`,
        })
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// ==============================================================
// Composable — 响应式封装
// ==============================================================

/**
 * @param {import('vue').Ref|Object} studioConfigRef - 项目配置（响应式）
 * @param {import('vue').Ref|Object} availabilityRef - 当日可用性数据（响应式）
 */
export function useBookingEngine(studioConfigRef, availabilityRef) {

  // ---- 内部联动状态 ----
  const optType        = ref('single')       // 'single' | 'package'
  const photoCount     = ref(1)              // 张数 / 套餐数
  const modelExperience = ref('experienced')  // 'experienced' | 'new'
  const startTime      = ref('')             // "HH:mm"

  // ---- 从外部配置中解构耗时规则 ----
  const rules = computed(() => {
    const cfg = unref(studioConfigRef)
    if (!cfg) return {}
    return {
      singleDuration:   cfg.single_duration_minutes   ?? 60,
      sessionDuration:  cfg.package_session_duration_minutes ?? 60,
      restInterval:     cfg.rest_interval_minutes      ?? 0,
      newCustomerExtra: cfg.new_customer_extra_minutes ?? 0,
      packageSessionCount: cfg.package_session_count   ?? 1,
    }
  })

  // ---- 可用性数据 ----
  const avail = computed(() => unref(availabilityRef) || {})

  // ---- 核心计算：时间块 ----
  const computedTimeBlock = computed(() => {
    return computeTimeBlock({
      pricingType: optType.value,
      count: clampCount(optType.value, photoCount.value, unref(studioConfigRef)),
      isNewCustomer: modelExperience.value === 'new',
      startTime: startTime.value,
      rules: rules.value,
    })
  })

  // ---- 核心计算：客户端冲突预校验 ----
  const conflictValidation = computed(() => {
    const block = computedTimeBlock.value
    const a = avail.value
    return checkConflict({
      startTime: block.startTime,
      endTime: block.endTime,
      openTime: a.open_time  || a.start_time || '00:00',
      closeTime: a.close_time || a.end_time   || '24:00',
      restSlots: a.rest_slots || [],
    })
  })

  // ---- 计算价格 ----
  const computedPrice = computed(() => {
    const cfg = unref(studioConfigRef)
    if (!cfg) return 0
    if (optType.value === 'single') {
      return (parseFloat(cfg.single_price) || 0) * photoCount.value
    }
    return (parseFloat(cfg.package_price) || 0) * photoCount.value
  })

  // ---- 最终能否进入下一步 ----
  const canProceed = computed(() => {
    if (!startTime.value) return false
    if (photoCount.value <= 0) return false
    const block = computedTimeBlock.value
    if (!block.endTime || block.totalMinutes <= 0) return false
    return conflictValidation.value.valid
  })

  // ---- 重置表单 ----
  function resetForm() {
    optType.value = 'single'
    photoCount.value = 1
    modelExperience.value = 'experienced'
    startTime.value = ''
  }

  /**
   * 根据当前状态生成提交 payload（供 UI 层调用 API 时使用）
   * @param {Object} overrides — 覆盖字段 (user_name, user_phone, remark, booking_date 等)
   */
  function buildSubmitPayload(overrides = {}) {
    const block = computedTimeBlock.value
    const cfg = unref(studioConfigRef)
    return {
      studio_id: cfg?.id,
      pricing_type: optType.value,
      quantity: photoCount.value,
      is_new_customer: modelExperience.value === 'new',
      start_time: startTime.value,
      ...overrides,
      // 以下由引擎产出，用于前端展示或调试
      _computed: {
        end_time: block.endTime,
        total_minutes: block.totalMinutes,
        session_count: block.sessionCount,
        total_amount: computedPrice.value,
      },
    }
  }

  return {
    // 状态
    optType,
    photoCount,
    modelExperience,
    startTime,

    // 计算产物
    computedTimeBlock,
    conflictValidation,
    computedPrice,
    canProceed,

    // 纯函数导出（供外部直接使用或单元测试）
    computeTimeBlock,
    checkConflict,

    // 工具方法
    resetForm,
    buildSubmitPayload,
  }
}

// ==============================================================
// 内部辅助
// ==============================================================

/**
 * 根据 pricing_type 校验 count 的合理范围
 * single: 最少 1 张
 * package: 最少 1 套
 */
function clampCount(pricingType, count, cfg) {
  if (!Number.isFinite(count) || count < 1) return 1
  return count
}

export { computeTimeBlock, checkConflict, timeToMinutes, minutesToTime, calculateShootingDuration, checkTimeConflict }
