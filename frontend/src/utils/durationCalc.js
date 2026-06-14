// ══════════════════════════════════════════
// 内部辅助：字符串 ↔ 分钟互转
// ══════════════════════════════════════════

function toMin(t) {
  if (!t) return 0
  if (typeof t === 'number') return t
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function padTime(m) {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0')
}

// ══════════════════════════════════════════
// calculateShootingDuration — 拍摄服务时长计算（纯函数）
// ══════════════════════════════════════════

/**
 * 双模式：
 *   A 套餐模式: actualShootingTime = selectedPackage.fixedDuration
 *   B 单张模式: actualShootingTime = photoCount × (timePerPhoto + noviceExtra)
 *   统一尾部:   totalBlockedTime = actualShootingTime + restTime
 *
 * @param {Object}  params
 * @param {number}  params.photoCount        - 拍摄张数，套餐模式下被忽略
 * @param {number}  params.timePerPhoto      - 每张基础耗时，套餐模式下被忽略
 * @param {boolean} params.isNovice          - 是否新手，套餐模式下被忽略
 * @param {number}  params.noviceExtraTime   - 新手每张加时，套餐模式下被忽略
 * @param {number}  params.restTime          - 拍摄后休息时间
 * @param {Object|null} params.selectedPackage - 套餐 { fixedDuration }，无则为 null
 * @returns {{ actualShootingTime: number, totalBlockedTime: number }}
 */
export function calculateShootingDuration({
  photoCount,
  timePerPhoto,
  isNovice,
  noviceExtraTime,
  restTime,
  selectedPackage = null,
}) {
  const rest = Number.isFinite(restTime) ? restTime : 0

  let actualShootingTime

  // 分支 A：套餐模式 → 固定耗时，忽略张数/新手/单次耗时
  if (selectedPackage && Number.isFinite(selectedPackage.fixedDuration) && selectedPackage.fixedDuration > 0) {
    actualShootingTime = selectedPackage.fixedDuration
  } else {
    // 分支 B：单张模式
    const count = Math.max(1, Number.isFinite(photoCount) ? photoCount : 1)
    const base = Number.isFinite(timePerPhoto) ? timePerPhoto : 60
    const extra = isNovice && Number.isFinite(noviceExtraTime) ? noviceExtraTime : 0
    actualShootingTime = count * (base + extra)
  }

  const totalBlockedTime = actualShootingTime + rest

  return {
    actualShootingTime: Math.round(actualShootingTime * 100) / 100,
    totalBlockedTime: Math.round(totalBlockedTime * 100) / 100,
  }
}

/**
 * 根据服务类型（单张/套餐）推导单次耗时参数
 *
 * @param {'single'|'package'} optType
 * @param {Object} studio       - 项目配置
 * @param {Object} [style]      - 所选样式（可选）
 * @returns {{ timePerPhoto: number, noviceExtraTime: number, restTime: number }}
 */
export function resolveTimingParams(optType, studio, style = null) {
  const isSingle = optType === 'single'

  let timePerPhoto
  if (isSingle) {
    timePerPhoto = style?.baseDuration || studio?.singleShotTime || 60
  } else {
    timePerPhoto = style?.packageDuration || studio?.packageTime || 120
  }

  let noviceExtraTime = 0
  if (studio?.isExperienceEnabled) {
    noviceExtraTime = isSingle
      ? (studio?.noviceSingleAddTime || 0)
      : (studio?.novicePackageAddTime || 0)
  }

  const restTime = studio?.intervalRestTime || 0

  return { timePerPhoto, noviceExtraTime, restTime }
}

// ══════════════════════════════════════════
// checkTimeConflict — 时间段冲突检测（纯函数）
// ══════════════════════════════════════════

/**
 * 检测新时段是否与已有不可用时段冲突。
 * 首尾相连允许，交叉重叠禁止。
 */
export function checkTimeConflict(newSlot, existingSlots = []) {
  const ns = toMin(newSlot.start)
  const ne = toMin(newSlot.end)

  if (!Array.isArray(existingSlots) || existingSlots.length === 0) {
    return { hasConflict: false, conflicts: [], message: '', firstConflict: null }
  }

  const conflicts = []

  for (const slot of existingSlots) {
    const ss = toMin(slot.start)
    const se = toMin(slot.end)

    if (ns < se && ne > ss) {
      conflicts.push({
        start: padTime(ss),
        end: padTime(se),
        type: slot.type || 'blocked',
        reason: slot.reason || '',
        lockType: slot.lockType || '',
        orderNo: slot.orderNo || '',
      })
    }
  }

  const first = conflicts[0] || null

  let message = ''
  if (first) {
    if (first.lockType === 'hard_lock') {
      message = `与已确认锁定订单（${first.start}—${first.end}）有冲突`
    } else if (first.type === 'rest') {
      message = `与休息时段（${first.start}—${first.end}）重叠`
    } else {
      message = `与被预锁时段（${first.start}—${first.end}）有冲突`
    }
    if (conflicts.length > 1) message += `，另有 ${conflicts.length - 1} 处重叠`
  }

  return { hasConflict: conflicts.length > 0, conflicts, message, firstConflict: first }
}

/**
 * 给定占用时长，在营业范围内找出所有可用的起始时间位置。
 */
export function findAvailableStartTimes(openTime, closeTime, blockedSlots, durationMin, step = 5) {
  const bs = toMin(openTime)
  const be = toMin(closeTime)
  if (be <= bs || durationMin <= 0) return []

  const blocks = (blockedSlots || [])
    .map(s => ({ start: Math.max(toMin(s.start), bs), end: Math.min(toMin(s.end), be) }))
    .filter(s => s.end > s.start)
    .sort((a, b) => a.start - b.start)

  const results = []
  let cursor = bs
  for (const block of blocks) {
    while (cursor + durationMin <= block.start) {
      results.push({ start: padTime(cursor), end: padTime(cursor + durationMin), startMin: cursor, endMin: cursor + durationMin })
      cursor += step
    }
    cursor = Math.max(cursor, block.end)
  }
  while (cursor + durationMin <= be) {
    results.push({ start: padTime(cursor), end: padTime(cursor + durationMin), startMin: cursor, endMin: cursor + durationMin })
    cursor += step
  }
  return results
}
