/**
 * calculateShootingDuration 单元测试
 *
 * 运行方式:
 *   cd frontend && node src/utils/durationCalc.test.js
 *
 * 注意: 本文件使用 ES module 语法 (同 Vite 项目规范)。
 * Node ≥ 14 支持 .mjs 或 package.json "type":"module"。
 * 如项目 package.json 未声明 type:module，请改为 durationCalc.test.mjs。
 */

// ---- 内联复制纯函数 (避免 import 路径差异) ----
function calculateShootingDuration({
  photoCount,
  timePerPhoto,
  isNovice,
  noviceExtraTime,
  restTime,
}) {
  const count = Math.max(1, Number.isFinite(photoCount) ? photoCount : 1)
  const base = Number.isFinite(timePerPhoto) ? timePerPhoto : 60
  const extra = isNovice && Number.isFinite(noviceExtraTime) ? noviceExtraTime : 0
  const rest = Number.isFinite(restTime) ? restTime : 0

  const actualShootingTime = count * (base + extra)
  const totalBlockedTime = actualShootingTime + rest

  return {
    actualShootingTime: Math.round(actualShootingTime * 100) / 100,
    totalBlockedTime: Math.round(totalBlockedTime * 100) / 100,
  }
}

// ============================================================
// 测试用例
// ============================================================

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`    ${e.message}`)
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed')
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label || 'value'}: expected ${expected}, got ${actual}`)
  }
}

// ---- 基础场景 ----
console.log('\n基础场景')
test('1张照片，老手，无休息', () => {
  const r = calculateShootingDuration({
    photoCount: 1, timePerPhoto: 10, isNovice: false,
    noviceExtraTime: 0, restTime: 0,
  })
  assertEq(r.actualShootingTime, 10, 'actual')
  assertEq(r.totalBlockedTime, 10, 'total')
})

test('3张照片，老手，无休息', () => {
  const r = calculateShootingDuration({
    photoCount: 3, timePerPhoto: 10, isNovice: false,
    noviceExtraTime: 0, restTime: 0,
  })
  assertEq(r.actualShootingTime, 30, 'actual')
  assertEq(r.totalBlockedTime, 30, 'total')
})

// ---- 新手场景 ----
console.log('\n新手场景')
test('1张，新手，每张+5分钟，无休息', () => {
  const r = calculateShootingDuration({
    photoCount: 1, timePerPhoto: 10, isNovice: true,
    noviceExtraTime: 5, restTime: 0,
  })
  assertEq(r.actualShootingTime, 15, 'actual')
  assertEq(r.totalBlockedTime, 15, 'total')
})

test('3张，新手，每张+5分钟，无休息', () => {
  const r = calculateShootingDuration({
    photoCount: 3, timePerPhoto: 10, isNovice: true,
    noviceExtraTime: 5, restTime: 0,
  })
  // 3 × (10 + 5) = 45
  assertEq(r.actualShootingTime, 45, 'actual')
  assertEq(r.totalBlockedTime, 45, 'total')
})

// ---- 休息时间 ----
console.log('\n休息时间场景')
test('1张，老手，15分钟休息', () => {
  const r = calculateShootingDuration({
    photoCount: 1, timePerPhoto: 10, isNovice: false,
    noviceExtraTime: 0, restTime: 15,
  })
  assertEq(r.actualShootingTime, 10, 'actual')
  assertEq(r.totalBlockedTime, 25, 'total')
})

test('3张，新手+5，15分钟休息', () => {
  const r = calculateShootingDuration({
    photoCount: 3, timePerPhoto: 10, isNovice: true,
    noviceExtraTime: 5, restTime: 15,
  })
  // actual = 3 × (10+5) = 45, total = 45 + 15 = 60
  assertEq(r.actualShootingTime, 45, 'actual')
  assertEq(r.totalBlockedTime, 60, 'total')
})

// ---- 边界值 ----
console.log('\n边界值')
test('photoCount=0 自动修正为1', () => {
  const r = calculateShootingDuration({
    photoCount: 0, timePerPhoto: 10, isNovice: false,
    noviceExtraTime: 0, restTime: 0,
  })
  assertEq(r.actualShootingTime, 10, 'actual')
})

test('photoCount 为负数自动修正为1', () => {
  const r = calculateShootingDuration({
    photoCount: -5, timePerPhoto: 10, isNovice: false,
    noviceExtraTime: 0, restTime: 0,
  })
  assertEq(r.actualShootingTime, 10, 'actual')
})

test('photoCount 为非数字自动修正为1', () => {
  const r = calculateShootingDuration({
    photoCount: 'abc', timePerPhoto: 10, isNovice: false,
    noviceExtraTime: 0, restTime: 0,
  })
  assertEq(r.actualShootingTime, 10, 'actual')
})

test('新手标志为 false 时忽略 noviceExtraTime', () => {
  const r = calculateShootingDuration({
    photoCount: 5, timePerPhoto: 8, isNovice: false,
    noviceExtraTime: 99, restTime: 0,
  })
  assertEq(r.actualShootingTime, 40, 'actual') // 5×8, not 5×(8+99)
})

// ---- 典型业务场景 ----
console.log('\n典型业务场景')
test('商业摄影：10张，每张5分钟，老手，休息15分钟', () => {
  const r = calculateShootingDuration({
    photoCount: 10, timePerPhoto: 5, isNovice: false,
    noviceExtraTime: 0, restTime: 15,
  })
  assertEq(r.actualShootingTime, 50, 'actual')
  assertEq(r.totalBlockedTime, 65, 'total')
})

test('商业摄影：10张，每张5分钟，新手+20，休息15分钟', () => {
  const r = calculateShootingDuration({
    photoCount: 10, timePerPhoto: 5, isNovice: true,
    noviceExtraTime: 20, restTime: 15,
  })
  // actual = 10 × (5+20) = 250, total = 250 + 15 = 265
  assertEq(r.actualShootingTime, 250, 'actual')
  assertEq(r.totalBlockedTime, 265, 'total')
})

test('coser场照：1张，60分钟，老手，休息15分钟', () => {
  const r = calculateShootingDuration({
    photoCount: 1, timePerPhoto: 60, isNovice: false,
    noviceExtraTime: 0, restTime: 15,
  })
  assertEq(r.actualShootingTime, 60, 'actual')
  assertEq(r.totalBlockedTime, 75, 'total')
})

// ============================================================
// checkTimeConflict 测试
// ============================================================

function checkTimeConflict(newSlot, existingSlots = []) {
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
        start: padTime(ss), end: padTime(se),
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
      message = `您选择的时间段与已确认锁定的订单（${first.start}—${first.end}）有冲突`
    } else if (first.type === 'rest') {
      message = `您选择的时间段与休息时段（${first.start}—${first.end}）重叠`
    } else {
      message = `您选择的时间段与被预锁时段（${first.start}—${first.end}）有冲突`
    }
    if (conflicts.length > 1) message += `，另有 ${conflicts.length - 1} 处重叠`
  }
  return { hasConflict: conflicts.length > 0, conflicts, message, firstConflict: first }
}

console.log('\ncheckTimeConflict 测试')

// ---- 无冲突 ----
console.log('\n无冲突场景')
test('新时段完全在空闲区', () => {
  const r = checkTimeConflict(
    { start: '10:00', end: '11:00' },
    [{ start: '14:00', end: '15:00' }],
  )
  assert(!r.hasConflict, 'should have no conflict')
  assertEq(r.conflicts.length, 0, 'conflicts count')
})

test('空白 slots 数组', () => {
  const r = checkTimeConflict({ start: '10:00', end: '11:00' }, [])
  assert(!r.hasConflict, 'empty should be no conflict')
})

test('传入 null/undefined', () => {
  const r = checkTimeConflict({ start: '10:00', end: '11:00' }, null)
  assert(!r.hasConflict, 'null should be no conflict')
})

// ---- 首尾相连 (应允许) ----
console.log('\n首尾相连场景（应允许）')
test('新时段在前，结束时间恰好等于已有区间的开始', () => {
  const r = checkTimeConflict(
    { start: '09:00', end: '10:00' },
    [{ start: '10:00', end: '11:00' }],
  )
  assert(!r.hasConflict, 'adjacent (before) should be allowed')
})

test('新时段在后，开始时间恰好等于已有区间的结束', () => {
  const r = checkTimeConflict(
    { start: '11:00', end: '12:00' },
    [{ start: '10:00', end: '11:00' }],
  )
  assert(!r.hasConflict, 'adjacent (after) should be allowed')
})

// ---- 交叉重叠 (应拦截) ----
console.log('\n交叉重叠场景（应拦截）')
test('新时段完全被已有区间包含', () => {
  const r = checkTimeConflict(
    { start: '10:30', end: '11:30' },
    [{ start: '10:00', end: '12:00' }],
  )
  assert(r.hasConflict, 'fully contained should conflict')
  assertEq(r.conflicts.length, 1, 'conflicts count')
})

test('新时段完全包含已有区间', () => {
  const r = checkTimeConflict(
    { start: '09:00', end: '13:00' },
    [{ start: '10:00', end: '12:00' }],
  )
  assert(r.hasConflict, 'fully containing should conflict')
})

test('新时段尾部侵入已有区间', () => {
  const r = checkTimeConflict(
    { start: '09:00', end: '10:30' },
    [{ start: '10:00', end: '12:00' }],
  )
  assert(r.hasConflict, 'tail overlap should conflict')
})

test('新时段头部侵入已有区间', () => {
  const r = checkTimeConflict(
    { start: '11:30', end: '13:00' },
    [{ start: '10:00', end: '12:00' }],
  )
  assert(r.hasConflict, 'head overlap should conflict')
})

test('新时段恰好与已有区间完全相同', () => {
  const r = checkTimeConflict(
    { start: '10:00', end: '11:00' },
    [{ start: '10:00', end: '11:00' }],
  )
  assert(r.hasConflict, 'identical should conflict')
})

// ---- 多 block 场景 ----
console.log('\n多 block 场景')
test('穿过多个已有区间', () => {
  const r = checkTimeConflict(
    { start: '09:00', end: '17:00' },
    [
      { start: '10:00', end: '11:00' },
      { start: '14:00', end: '15:00' },
    ],
  )
  assert(r.hasConflict, 'spanning multiple blocks')
  assertEq(r.conflicts.length, 2, 'should have 2 conflicts')
})

test('仅命中其中一个已有区间', () => {
  const r = checkTimeConflict(
    { start: '13:00', end: '14:30' },
    [
      { start: '10:00', end: '11:00' },
      { start: '14:00', end: '15:00' },
    ],
  )
  assert(r.hasConflict, 'hitting one block')
  assertEq(r.conflicts.length, 1, 'should have 1 conflict')
})

// ---- 边界值 ----
console.log('\n边界值')
test('仅 1 分钟重叠也应被拦截', () => {
  const r = checkTimeConflict(
    { start: '09:59', end: '11:00' },
    [{ start: '10:00', end: '12:00' }],
  )
  assert(r.hasConflict, '1-minute overlap should still conflict')
})

test('同一时刻两端相接（0 分钟间隙）不冲突', () => {
  const r = checkTimeConflict(
    { start: '11:00', end: '11:30' },
    [{ start: '11:30', end: '12:00' }],
  )
  assert(!r.hasConflict, 'exact adjacent should be allowed')
})

// ---- 结果 ----
console.log(`\n${'='.repeat(40)}`)
console.log(`通过: ${passed}  |  失败: ${failed}  |  总计: ${passed + failed}`)
