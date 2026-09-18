/**
 * 固定档位引擎 (studios.time_mode = 'fixed_slot')
 *
 * 与 timeCollisionEngine 的分工：
 *   那边管「任意区间是否碰撞」，这边管「把营业时间切成固定网格档位，并标出哪几档可用」。
 *
 * ★ 锚点规则：档位起点恒为 baseStartTime + k × slotDuration（09:00 / 09:30 / 10:00 …）。
 *   中间被休息或订单打断也**不重新对齐**，只保留能完整落在 [baseStart, baseEnd] 内的档。
 *   注意不要复用 frontend/src/utils/durationCalc.js 的 findAvailableStartTimes —— 它把游标
 *   设成被占区间的末尾，午休 12:10–12:50 之后会漂成 12:50 / 13:20，锚点会漂。
 *
 * ★ 本文件是档位语义的唯一实现。前端不做第二份，由 getBookedTimesV2 下发 slots 供其渲染。
 */
const { timeToMinutes, minutesToTime } = require('./dateHelper');

/** "HH:MM:SS" / Date / Time → "HH:MM" */
function hhmm(v) {
  if (!v) return null;
  return typeof v === 'string' ? v.slice(0, 5) : String(v).slice(0, 5);
}

/**
 * 把任意来源的阻塞区间归一化成 { startMin, endMin, kind, orderNo, lockType }
 * 接受 {start,end} 与 {start_time,end_time} 两种字段名（前者来自 getBookedTimesV2，
 * 后者来自 slot_bookings/studio_rest_slots 原始行）。
 */
function normalizeBlocked(blockedRanges = []) {
  return (blockedRanges || [])
    .map((b) => {
      if (!b) return null;
      const s = hhmm(b.start !== undefined ? b.start : b.start_time);
      const e = hhmm(b.end !== undefined ? b.end : b.end_time);
      if (!s || !e) return null;
      return {
        startMin: timeToMinutes(s),
        endMin: timeToMinutes(e),
        kind: b.kind || 'booked',
        orderNo: b.orderNo || b.order_no || null,
        lockType: b.lockType || b.lock_type || null,
      };
    })
    .filter((b) => b && b.endMin > b.startMin);
}

/**
 * 生成当天的全部档位（含不可用的，供模板/选择器标出"已满"）
 *
 * @param {Object} p
 * @param {string} p.baseStartTime 'HH:MM'
 * @param {string} p.baseEndTime   'HH:MM'
 * @param {number} p.slotDuration  每档分钟数
 * @param {Array}  p.blockedRanges 休息 + 已占用
 * @returns {Array<{start,end,startMin,endMin,available,blockedBy,orderNo,lockType}>}
 */
function generateFixedSlots({ baseStartTime, baseEndTime, slotDuration, blockedRanges = [] }) {
  const bs = timeToMinutes(hhmm(baseStartTime));
  const be = timeToMinutes(hhmm(baseEndTime));
  const dur = parseInt(slotDuration, 10);
  if (!bs || !be || be <= bs || !dur || dur <= 0) return [];

  const blocks = normalizeBlocked(blockedRanges);
  const out = [];
  for (let s = bs; s + dur <= be; s += dur) {
    const e = s + dur;
    const hit = blocks.find((b) => s < b.endMin && e > b.startMin) || null;
    out.push({
      start: minutesToTime(s),
      end: minutesToTime(e),
      startMin: s,
      endMin: e,
      available: !hit,
      blockedBy: hit ? hit.kind : null,
      orderNo: hit ? hit.orderNo : null,
      lockType: hit ? hit.lockType : null,
    });
  }
  return out;
}

/** 起点是否落在档位网格上（createOrderV2 与 Excel 导入共用） */
function isSlotAligned(startTime, baseStartTime, slotDuration) {
  const dur = parseInt(slotDuration, 10);
  const s = hhmm(startTime);
  const bs = hhmm(baseStartTime);
  if (!dur || dur <= 0 || !s || !bs) return false;
  const offset = timeToMinutes(s) - timeToMinutes(bs);
  return offset >= 0 && offset % dur === 0;
}

/**
 * 取某项目某天「真正有效」的占用区间。
 *
 * 比 checkTimeCollision 的默认查询严格：JOIN orders 排除已取消/已退款，
 * 并丢弃缺 end_time / 起止倒挂的脏占位行 —— 被取消的订单不应该继续挡住档位。
 * 模板导出与 Excel 导入都走这里，两侧看到的"已占用"才一致。
 */
async function loadOccupiedRanges({ knex, trx = null, mId, studioId, bookingDate, excludeOrderNo = '' }) {
  let q = knex('slot_bookings as sb')
    .join('orders as o', 'sb.order_no', 'o.order_no')
    .where({ 'sb.m_id': mId, 'sb.studio_id': studioId, 'sb.booking_date': bookingDate })
    .whereNotIn('o.status', ['已取消', '已退款取消'])
    .where('o.service_status', '!=', 'CANCELLED');
  if (trx) q = q.transacting(trx);
  if (excludeOrderNo) q = q.whereNot('sb.order_no', excludeOrderNo);

  const rows = await q.select('sb.start_time', 'sb.end_time', 'sb.order_no', 'sb.lock_type');
  return rows
    .map((r) => ({
      start: hhmm(r.start_time),
      end: hhmm(r.end_time),
      orderNo: r.order_no,
      lockType: r.lock_type,
      kind: 'booked',
    }))
    .filter((r) => r.start && r.end && timeToMinutes(r.end) > timeToMinutes(r.start));
}

module.exports = { generateFixedSlots, isSlotAligned, loadOccupiedRanges, normalizeBlocked, hhmm };
