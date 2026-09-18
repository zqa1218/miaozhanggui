/**
 * 高精度时间碰撞引擎
 *
 * 核心职责:
 *  1. 计算订单总服务时长 (基础拍摄 + 模特加时 + 间隔休息)
 *  2. 闭合时间段重叠检测 (interval overlap)
 *  3. 并发安全的行级锁获取
 */
const { timeToMinutes, minutesToTime } = require('./dateHelper');

/**
 * 计算总服务时长 (分钟)
 * @param {Object} params
 * @param {number} params.baseShotTime  - 基础拍摄时间 (分钟)
 * @param {number} params.modelAddTime  - 模特经验加时 (分钟，0=老手)
 * @param {number} params.intervalRest  - 商家设定每单间隔休息 (分钟)
 * @returns {number}
 */
function calcTotalDuration({ baseShotTime, modelAddTime, intervalRest }) {
  return (baseShotTime || 0) + (modelAddTime || 0) + (intervalRest || 0);
}

/**
 * 计算结束时间
 * @param {string} startTimeStr - "HH:MM"
 * @param {number} durationMinutes
 * @returns {string} "HH:MM"
 */
function computeEndTime(startTimeStr, durationMinutes) {
  return minutesToTime(timeToMinutes(startTimeStr) + durationMinutes);
}

/**
 * 检查两个闭合区间 [aStart, aEnd) 和 [bStart, bEnd) 是否重叠
 * 重叠条件: aStart < bEnd AND aEnd > bStart
 */
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) &&
         timeToMinutes(aEnd) > timeToMinutes(bStart);
}

/**
 * 检查拟定预约时段是否与休息时段 / 已有预定冲突
 *
 * @param {Object} params
 * @param {string}  params.bookingDate
 * @param {string}  params.bookingStartTime - "HH:MM"
 * @param {string}  params.bookingEndTime   - "HH:MM"
 * @param {number}  params.studioId
 * @param {string}  params.mId
 * @param {Object}  params.knex            - Knex 实例
 * @param {Object}  [params.trx]           - 可选事务对象
 * @param {Array}   [params.restSlots]     - 预查询的休息时段 [{start_time, end_time}]
 * @param {Array}   [params.occupiedSlots] - 预查询的已占用时段（可含已取消过滤），
 *                                           不传时按原逻辑查 slot_bookings。
 *                                           接受 [{start,end}] 或 [{start_time,end_time}]
 * @param {string}  [params.excludeOrderNo] - 排除某订单 (改期时用)
 * @returns {Object} { hasCollision: boolean, conflicts: string[] }
 */
async function checkTimeCollision({
  bookingDate, bookingStartTime, bookingEndTime,
  studioId, mId, knex, trx, restSlots, occupiedSlots, excludeOrderNo,
}) {
  const conflicts = [];

  // 1. 检查休息时段
  const rests = restSlots || await (trx
    ? knex('studio_rest_slots').transacting(trx).where('studio_id', studioId).select('start_time', 'end_time')
    : knex('studio_rest_slots').where('studio_id', studioId).select('start_time', 'end_time'));

  for (const rest of rests) {
    const rs = typeof rest.start_time === 'string' ? rest.start_time.slice(0, 5) : rest.start_time;
    const re = typeof rest.end_time === 'string' ? rest.end_time.slice(0, 5) : rest.end_time;
    if (intervalsOverlap(bookingStartTime, bookingEndTime, rs, re)) {
      conflicts.push(`与休息时段 ${rs}-${re} 冲突`);
    }
  }

  // 2. 检查已有 slot_bookings
  //    occupiedSlots 是调用方预取的结果（Excel 导入用它复用「已 JOIN orders 排除取消单」
  //    的那次查询）；不传时走原查询，既有调用方行为逐字节不变。
  let bookedSlots;
  if (occupiedSlots) {
    bookedSlots = occupiedSlots.map((s) => ({
      start_time: s.start_time !== undefined ? s.start_time : s.start,
      end_time: s.end_time !== undefined ? s.end_time : s.end,
      lock_type: s.lock_type !== undefined ? s.lock_type : s.lockType,
      order_no: s.order_no !== undefined ? s.order_no : s.orderNo,
    }));
  } else {
    let query = trx
      ? knex('slot_bookings').transacting(trx)
      : knex('slot_bookings');
    query = query.where({ m_id: mId, studio_id: studioId, booking_date: bookingDate });

    if (excludeOrderNo) {
      query = query.whereNot('order_no', excludeOrderNo);
    }

    bookedSlots = await query.select('start_time', 'end_time', 'lock_type', 'order_no');
  }

  for (const slot of bookedSlots) {
    const ss = typeof slot.start_time === 'string' ? slot.start_time.slice(0, 5) : slot.start_time;
    const se = typeof slot.end_time === 'string' ? slot.end_time.slice(0, 5) : slot.end_time;
    if (intervalsOverlap(bookingStartTime, bookingEndTime, ss, se)) {
      const label = slot.lock_type === 'hard_lock'
        ? `与已被确认锁定的订单 ${slot.order_no} 时段 ${ss}-${se} 冲突`
        : `与已被定金锁定的订单 ${slot.order_no} 时段 ${ss}-${se} 冲突`;
      conflicts.push(label);
    }
  }

  return { hasCollision: conflicts.length > 0, conflicts };
}

/**
 * 对指定 studio+date 的所有 slot_bookings 加行级锁 (SELECT FOR UPDATE)
 * 必须在事务内调用，防止并发插入导致重叠
 */
async function acquireSlotLocks({ knex, trx, bookingDate, studioId, mId }) {
  await knex('slot_bookings')
    .transacting(trx)
    .where({ m_id: mId, studio_id: studioId, booking_date: bookingDate })
    .forUpdate()
    .select('id');
}

module.exports = {
  calcTotalDuration,
  computeEndTime,
  intervalsOverlap,
  checkTimeCollision,
  acquireSlotLocks,
};
