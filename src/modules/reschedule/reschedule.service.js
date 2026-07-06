const knex = require('../../shared/database/knex');
const AppError = require('../../shared/errors/AppError');
const ERROR_CODES = require('../../shared/errors/errorCodes');
const { expandTimeRange, timeToMinutes, minutesToTime } = require('../../shared/utils/dateHelper');
const repo = require('./reschedule.repository');
const orderRepo = require('../order/order.repository');
const scheduleRepo = require('../schedule/schedule.repository');

const SUB_SLOT_STEP = 30;

function buildSubSlotSet(times, timesEnd) {
  const set = new Set();
  for (let i = 0; i < times.length; i++) {
    const start = times[i];
    const end = timesEnd ? timesEnd[i] : null;
    if (end) {
      expandTimeRange(start, end, SUB_SLOT_STEP).forEach((s) => set.add(s));
    } else {
      set.add(start);
    }
  }
  return set;
}

async function apply(data) {
  await repo.create({
    m_id: data.mId,
    order_no: data.orderNo,
    old_date: data.oldDate,
    old_times: JSON.stringify(data.oldTimes),
    old_times_end: data.oldTimesEnd ? JSON.stringify(data.oldTimesEnd) : null,
    new_date: data.newDate,
    new_times: JSON.stringify(data.newTimes),
    new_times_end: data.newTimesEnd ? JSON.stringify(data.newTimesEnd) : null,
    reason: data.reason || '',
    status: '待处理',
  });

  //   通知商家
  const notificationRepo = require('../notification/notification.repository');
  setImmediate(async () => {
    try {
      await notificationRepo.insert({
        m_id: data.mId,
        title: '  改期申请',
        content: `订单 ${data.orderNo} 申请从 ${data.oldDate} 改至 ${data.newDate}`,
        type: 'warning',
        order_no: data.orderNo,
      });
      const ws = require('../../shared/websocket').get();
      if (ws) ws.notifyMerchant(data.mId, {
        type: 'reschedule_request', orderNo: data.orderNo,
        data: { oldDate: data.oldDate, newDate: data.newDate },
      });
    } catch (_) { /* 静默失败 */ }
  });

  return { success: true, message: '  改期申请已提交  ' };
}

async function list(mId, status) {
  const rows = await repo.findByMerchant(mId, status);
  return rows.map((r) => ({
    id: r.id,
    orderNo: r.order_no,
    oldDate: fmtDate(r.old_date),
    oldTimes: safeJson(r.old_times),
    oldTimesEnd: safeJson(r.old_times_end),
    newDate: fmtDate(r.new_date),
    newTimes: safeJson(r.new_times),
    newTimesEnd: safeJson(r.new_times_end),
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
  }));
}

function fmtDate(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  const d = new Date(v);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function approve(requestId, mId) {
  const req = await repo.findById(requestId);
  if (!req || req.m_id !== mId) throw new AppError(ERROR_CODES.RESCHEDULE_NOT_FOUND, 404);

  // 获取订单以取得正确的 studio_id
  const order = await orderRepo.findByOrderNo(req.order_no);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);

  // 校验订单状态：终态订单不允许改期
  if (['已取消', '已退款取消', '已完成拍摄'].includes(order.status)) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '  该订单已结束，不可改期  ');
  }

  // 检查包天冲突
  const pkgConflict = await scheduleRepo.hasPackageDayBooking(mId, order.studio_id, req.new_date);
  if (pkgConflict) throw new AppError(ERROR_CODES.FULL_DAY_BLOCKED, 400, '  新日期已被包场锁定  ');

  // 检查不可接单时段
  const unavailList = await scheduleRepo.getUnavailableSlots(mId, order.studio_id, req.new_date);
  const newTimes = safeJson(req.new_times, []);
  const newTimesEnd = safeJson(req.new_times_end, []);
  const newSubSlotsPre = buildSubSlotSet(newTimes, newTimesEnd);
  for (const row of unavailList) {
    const blockedSet = buildSubSlotSet([row.time_slot], row.time_slot_end ? [row.time_slot_end] : null);
    for (const s of blockedSet) {
      if (newSubSlotsPre.has(s)) {
        throw new AppError(ERROR_CODES.UNAVAILABLE_SLOT, 400, `  新时段 ${row.time_slot} 商家不接单  `);
      }
    }
  }

  return knex.transaction(async (trx) => {
    // ① 释放旧时段
    await scheduleRepo.deleteSlotsByOrderNo(trx, req.order_no);

    // ② 占用新时段（范围感知冲突检测）
    // 查询该日全部已有占用，构建已占子时段Set
    const allBooked = await knex('slot_bookings')
      .transacting(trx)
      .where({ m_id: mId, studio_id: order.studio_id, booking_date: req.new_date })
      .select('time_slot', 'time_slot_end');

    const bookedSubSet = new Set();
    for (const row of allBooked) {
      if (row.time_slot_end) {
        expandTimeRange(row.time_slot, row.time_slot_end, SUB_SLOT_STEP).forEach((s) => bookedSubSet.add(s));
      } else {
        bookedSubSet.add(row.time_slot);
      }
    }

    const newSubSlots = buildSubSlotSet(newTimes, newTimesEnd);
    for (const s of newSubSlots) {
      if (bookedSubSet.has(s)) {
        throw new AppError(ERROR_CODES.SLOT_CONFLICT, 400, `  新时段 ${s} 已被占用  `);
      }
    }

    // 对每个待选起始时间加行级锁
    for (let i = 0; i < newTimes.length; i++) {
      const t = newTimes[i];
      const tEnd = newTimesEnd[i] || null;
      await knex('slot_bookings')
        .transacting(trx)
        .where({ m_id: mId, studio_id: order.studio_id, booking_date: req.new_date, time_slot: t })
        .forUpdate()
        .first();

      await scheduleRepo.insertSlot(trx, {
        m_id: mId,
        studio_id: order.studio_id,
        booking_date: req.new_date,
        time_slot: t,
        time_slot_end: tEnd,
        start_time: t,
        end_time: tEnd || minutesToTime(timeToMinutes(t) + 60),
        order_no: req.order_no,
        is_package_day: false,
        booking_count: 1,
      });
    }

    // ③ 更新订单日期+时段（updateDateTimes 内部会 JSON.stringify）
    await orderRepo.updateDateTimes(trx, req.order_no, req.new_date, newTimes, newTimesEnd);

    // ④ 更新改期状态
    await repo.updateStatus(requestId, mId, '已同意');

    // ⑤ 通知
    setImmediate(async () => {
      try {
        const notificationRepo = require('../notification/notification.repository');
        await notificationRepo.insert({
          m_id: mId,
          title: '  改期已同意',
          content: `订单 ${req.order_no} 已改期至 ${req.new_date} ${newTimes.join(',')}`,
          type: 'success',
          order_no: req.order_no,
        });
      } catch (_) {}
    });

    return { success: true };
  });
}

async function reject(requestId, mId, reason) {
  const r = await repo.findById(requestId);
  if (!r || r.m_id !== mId) throw new AppError(ERROR_CODES.RESCHEDULE_NOT_FOUND, 404);
  await repo.updateStatus(requestId, mId, '已拒绝');

  // 存储拒绝原因到订单备注或单独字段
  if (reason) {
    setImmediate(async () => {
      try {
        const notificationRepo = require('../notification/notification.repository');
        await notificationRepo.insert({
          m_id: mId,
          title: '  改期已拒绝',
          content: `订单 ${r.order_no} 改期申请已被拒绝${reason ? '，回复：' + reason : ''}`,
          type: 'danger',
          order_no: r.order_no,
        });
      } catch (_) {}
    });
  }

  return { success: true };
}

function safeJson(v) {
  if (!v) return [];
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return []; }
}

async function getByOrderNo(orderNo, mId) {
  const rows = await repo.findByOrderNo(orderNo, mId);
  return rows.map((r) => ({
    id: r.id,
    orderNo: r.order_no,
    oldDate: fmtDate(r.old_date),
    oldTimes: safeJson(r.old_times),
    oldTimesEnd: safeJson(r.old_times_end),
    newDate: fmtDate(r.new_date),
    newTimes: safeJson(r.new_times),
    newTimesEnd: safeJson(r.new_times_end),
    status: r.status,
    createdAt: r.created_at,
  }));
}

module.exports = { apply, list, approve, reject, getByOrderNo };
