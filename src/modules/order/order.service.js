const knex = require('../../shared/database/knex');
const AppError = require('../../shared/errors/AppError');
const ERROR_CODES = require('../../shared/errors/errorCodes');
const { generateOrderNo } = require('../../shared/utils/orderNo');
const { calculate } = require('../../shared/utils/priceEngine');
const { timeToMinutes, expandTimeRange } = require('../../shared/utils/dateHelper');
const {
  calcTotalDuration, computeEndTime, checkTimeCollision, acquireSlotLocks,
} = require('../../shared/utils/timeCollisionEngine');
const orderRepo = require('./order.repository');
const scheduleRepo = require('../schedule/schedule.repository');
const studioRepo = require('../studio/studio.repository');
const notificationRepo = require('../notification/notification.repository');

const logger = require('../../shared/logger');

const SUB_SLOT_STEP = 30;

// ════════════════════════════════════════
//  状态枚举映射 — 英文 ⇄ 中文双向兼容
// ════════════════════════════════════════
const STATUS_MAP = {
  'pending':     '待支付',
  'pre_paid':    '已付定金',
  'confirmed':   '已确认锁定',
  'completed':   '已完成拍摄',
  'cancelled':   '已取消',
  'refunding':   '退款审核中',
  'refunded':    '已退款取消',
  'final_pending': '尾款待确认',
  'paid':        '已结清',
  'unsettled':         '未结清',
  'deposit_pending':   '定金待确认',
};

function normalizeStatus(input) {
  if (!input) return input;
  // 中文直接返回
  if (/[一-龥]/.test(input)) return input;
  return STATUS_MAP[input] || input;
}

// ════════════════════════════════════════
//  旧版兼容函数
// ════════════════════════════════════════

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

function checkUnavailableOverlap(selectedTimes, selectedTimesEnd, unavailList) {
  const mySet = buildSubSlotSet(selectedTimes, selectedTimesEnd);
  for (const row of unavailList) {
    const blockedSet = buildSubSlotSet([row.time_slot], row.time_slot_end ? [row.time_slot_end] : null);
    for (const s of blockedSet) {
      if (mySet.has(s)) {
        throw new AppError(ERROR_CODES.UNAVAILABLE_SLOT, 400, `时段 ${row.time_slot} 商家不接单`);
      }
    }
  }
}

/** 旧版创建订单 (保持兼容) */
async function createOrder(payload) {
  const studio = await studioRepo.findByIdAndMerchant(payload.studioId, payload.mId);
  if (!studio || studio.is_deleted) throw new AppError(ERROR_CODES.STUDIO_NOT_FOUND, 404);

  const orderNo = generateOrderNo();

  return knex.transaction(async (trx) => {
    if (payload.isPackageOrder) {
      const pkg = await scheduleRepo.hasPackageDayBooking(payload.mId, payload.studioId, payload.date);
      if (pkg) throw new AppError(ERROR_CODES.FULL_DAY_BLOCKED, 400, '该日已被包场');
    } else {
      const pkg = await scheduleRepo.hasPackageDayBooking(payload.mId, payload.studioId, payload.date);
      if (pkg) throw new AppError(ERROR_CODES.FULL_DAY_BLOCKED, 400, '该日已被包场锁定');
    }

    const unavailList = await scheduleRepo.getUnavailableSlots(payload.mId, payload.studioId, payload.date);
    checkUnavailableOverlap(payload.times, payload.timesEnd, unavailList);

    const allBooked = await knex('slot_bookings')
      .transacting(trx)
      .where({ m_id: payload.mId, studio_id: payload.studioId, booking_date: payload.date })
      .select('time_slot', 'time_slot_end');

    const bookedSubSet = new Set();
    for (const row of allBooked) {
      if (row.time_slot_end) {
        expandTimeRange(row.time_slot, row.time_slot_end, SUB_SLOT_STEP).forEach((s) => bookedSubSet.add(s));
      } else {
        bookedSubSet.add(row.time_slot);
      }
    }

    const newSubSlots = buildSubSlotSet(payload.times, payload.timesEnd);
    for (const s of newSubSlots) {
      if (bookedSubSet.has(s)) {
        throw new AppError(ERROR_CODES.SLOT_CONFLICT, 400, `时段 ${s} 已被预定`);
      }
    }

    for (const t of payload.times) {
      await knex('slot_bookings')
        .transacting(trx)
        .where({ m_id: payload.mId, studio_id: payload.studioId, booking_date: payload.date, time_slot: t })
        .forUpdate()
        .first();

      if (payload.calcMode === 'photo_time') {
        const totalPhotos = await knex('orders')
          .transacting(trx)
          .where({ m_id: payload.mId, studio_id: payload.studioId, order_date: payload.date })
          .whereRaw("JSON_CONTAINS(time_slots, ?)", [JSON.stringify(t)])
          .whereNotIn('status', ['已取消', '已退款取消'])
          .sum('photo_count as total')
          .first();

        const currentPhotos = (totalPhotos?.total || 0) + (payload.photoCount || 0);
        if (currentPhotos > studio.slot_max_photos) {
          throw new AppError(ERROR_CODES.PHOTO_LIMIT_EXCEEDED, 400, `时段 ${t} 接单数已达上限`);
        }
      }
    }

    for (let i = 0; i < payload.times.length; i++) {
      const t = payload.times[i];
      const tEnd = payload.timesEnd ? payload.timesEnd[i] : null;
      await scheduleRepo.insertSlot(trx, {
        m_id: payload.mId, studio_id: payload.studioId,
        booking_date: payload.date,
        time_slot: t, time_slot_end: tEnd,
        start_time: t, end_time: tEnd || computeEndTime(t, 60),
        order_no: orderNo,
        is_package_day: payload.isPackageOrder || false,
        booking_count: 1,
      });
    }

    await orderRepo.create(trx, {
      order_no: orderNo, m_id: payload.mId, studio_id: payload.studioId,
      studio_title: payload.studioTitle, service_mode: payload.serviceMode,
      order_date: payload.date,
      time_slots: JSON.stringify(payload.times),
      time_slots_end: payload.timesEnd ? JSON.stringify(payload.timesEnd) : null,
      is_package_order: payload.isPackageOrder || false,
      total_price: payload.totalPrice, deposit_amount: payload.depositAmount,
      deposit_ratio: payload.depositRatio, contact_info: payload.contact,
      people_count: payload.peopleCount || 1, photo_count: payload.photoCount || null,
      status: '待支付', user_device_id: payload.userDeviceId,
    });

    setImmediate(async () => {
      try {
        await notificationRepo.insert({
          m_id: payload.mId, title: '新订单通知',
          content: `项目:${payload.studioTitle} / 日期:${payload.date} / 时段:${payload.times.join(',')}`,
          type: 'info', order_no: orderNo,
        });
        const ws = require('../../shared/websocket').get();
        if (ws) ws.notifyMerchant(payload.mId, {
          type: 'new_order', orderNo,
          data: { studioTitle: payload.studioTitle, date: payload.date, times: payload.times },
        });
      } catch (_) { /* 静默 */ }
    });

    return { orderNo, totalPrice: payload.totalPrice, depositAmount: payload.depositAmount };
  });
}

// ════════════════════════════════════════
//  V2 高精度闭合时间下单 (不写 slot_bookings)
// ════════════════════════════════════════

async function createOrderV2(payload) {
  const studio = await studioRepo.findByIdAndMerchant(payload.studioId, payload.mId);
  if (!studio || studio.is_deleted) throw new AppError(ERROR_CODES.STUDIO_NOT_FOUND, 404);

  // 校验日期在可选范围内
  const availDates = await studioRepo.findAvailabilities(payload.studioId);
  const availSet = new Set(availDates.map(r =>
    typeof r.available_date === 'string' ? r.available_date.slice(0, 10) : r.available_date
  ));
  if (availDates.length > 0 && !availSet.has(payload.bookingStartDate)) {
    throw new AppError(ERROR_CODES.DATE_NOT_AVAILABLE, 400, '该日期不在项目可选范围内');
  }

  // 计算总时长和结束时间
  const isSingle = payload.optType === 'single';
  let totalDuration;
  if (payload.fixedDuration && payload.fixedDuration > 0) {
    // 套餐模式：使用套餐固定耗时 + 休息时间
    totalDuration = payload.fixedDuration + (studio.interval_rest_time || 0);
  } else {
    const baseShotTime = isSingle
      ? (studio.single_shot_time || 60)
      : (studio.package_time || 180);
    const isNewcomer = payload.modelExperience === 'newcomer';
    const modelAddTime = isNewcomer
      ? (isSingle ? (studio.novice_single_add_time || 0) : (studio.novice_package_add_time || 0))
      : 0;
    const intervalRest = studio.interval_rest_time || 0;
    totalDuration = calcTotalDuration({ baseShotTime, modelAddTime, intervalRest });
  }
  const bookingEndTime = computeEndTime(payload.bookingStartTime, totalDuration);

  // 校验不超出工作区间
  const baseStart = typeof studio.base_start_time === 'string' ? studio.base_start_time.slice(0, 5) : null;
  const baseEnd = typeof studio.base_end_time === 'string' ? studio.base_end_time.slice(0, 5) : null;
  if (baseStart && baseEnd) {
    if (timeToMinutes(payload.bookingStartTime) < timeToMinutes(baseStart) ||
        timeToMinutes(bookingEndTime) > timeToMinutes(baseEnd)) {
      throw new AppError(ERROR_CODES.TIME_CONFIG_INVALID, 400, '预约时段超出工作区间');
    }
  }

  const orderNo = generateOrderNo();

  // 获取有效价格
  let unitPrice = 0;
  if (studio.is_style_enabled && payload.styleId) {
    const style = await knex('styles').where({ id: payload.styleId, m_id: payload.mId }).first();
    if (!style) throw new AppError(ERROR_CODES.STYLE_NOT_FOUND, 404);
    unitPrice = isSingle ? style.single_price : (style.package_price || 0);
  } else {
    unitPrice = isSingle ? (studio.single_price || 0) : (studio.package_price || 0);
  }

  // 事务: 碰撞检测 + 写订单
  return knex.transaction(async (trx) => {
    // 行级锁
    await acquireSlotLocks({
      knex, trx, bookingDate: payload.bookingStartDate,
      studioId: payload.studioId, mId: payload.mId,
    });

    // 碰撞检测
    const restSlots = await studioRepo.findRestSlots(payload.studioId);
    const collision = await checkTimeCollision({
      bookingDate: payload.bookingStartDate,
      bookingStartTime: payload.bookingStartTime,
      bookingEndTime,
      studioId: payload.studioId, mId: payload.mId,
      knex, trx, restSlots,
    });

    if (collision.hasCollision) {
      throw new AppError(ERROR_CODES.LOCK_CONFLICT, 400, collision.conflicts.join('; '));
    }

    // 写入订单 (不写 slot_bookings)
    await orderRepo.create(trx, {
      order_no: orderNo, m_id: payload.mId, studio_id: payload.studioId,
      style_id: payload.styleId || null,
      opt_type: payload.optType,
      order_date: payload.bookingStartDate,
      booking_start_time: payload.bookingStartTime,
      booking_end_time: bookingEndTime,
      model_experience: payload.modelExperience || null,
      role_name: payload.roleName || '',
      contact_type: payload.contactType || '',
      contact_value: payload.contactValue || '',
      contact_note: payload.contactNote || '',
      total_price: payload.totalPrice,
      deposit_amount: payload.depositAmount,
      deposit_ratio: payload.depositRatio,
	      selected_addon_ids: JSON.stringify(payload.selectedAddonIds || []),
	      addon_total: payload.addonTotal || 0,
	      extra_items: JSON.stringify(payload.extraItems || []),
	            photo_count: payload.photoCount || null,
      // 兼容旧列
      studio_title: studio.title,
      service_mode: studio.service_mode || 'studio',
      time_slots: JSON.stringify([payload.bookingStartTime]),
      time_slots_end: JSON.stringify([bookingEndTime]),
      contact_info: payload.contactNote || '',
      people_count: 1,
      status: '待支付',
      user_device_id: payload.userDeviceId,
      user_id: payload.userId || null,
    });

    // 异步通知
    setImmediate(async () => {
      try {
        await notificationRepo.insert({
          m_id: payload.mId, title: '新订单通知',
          content: `项目:${studio.title} / 日期:${payload.bookingStartDate} / 时段:${payload.bookingStartTime}-${bookingEndTime}`,
          type: 'info', order_no: orderNo,
        });
        const ws = require('../../shared/websocket').get();
        if (ws) ws.notifyMerchant(payload.mId, {
          type: 'new_order', orderNo,
          data: { studioTitle: studio.title, date: payload.bookingStartDate, timeRange: `${payload.bookingStartTime}-${bookingEndTime}` },
        });
      } catch (_) { /* 静默 */ }
    });

    return { orderNo, totalPrice: payload.totalPrice, depositAmount: payload.depositAmount, bookingEndTime };
  });
}

// ════════════════════════════════════════
//  支付定金 (写入 pre_lock slot_booking)
// ════════════════════════════════════════

async function payDeposit(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.status !== '待支付') throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '仅待支付状态可付定金');

  const startTime = order.booking_start_time
    ? (typeof order.booking_start_time === 'string' ? order.booking_start_time.slice(0, 5) : order.booking_start_time)
    : null;
  const endTime = order.booking_end_time
    ? (typeof order.booking_end_time === 'string' ? order.booking_end_time.slice(0, 5) : order.booking_end_time)
    : null;

  return knex.transaction(async (trx) => {
    if (startTime && endTime) {
      // 行级锁 + 二次碰撞校验
      await acquireSlotLocks({
        knex, trx,
        bookingDate: fmtDate(order.order_date),
        studioId: order.studio_id, mId: order.m_id,
      });

      const restSlots = await studioRepo.findRestSlots(order.studio_id);
      const collision = await checkTimeCollision({
        bookingDate: fmtDate(order.order_date),
        bookingStartTime: startTime,
        bookingEndTime: endTime,
        studioId: order.studio_id, mId: order.m_id,
        knex, trx, restSlots, excludeOrderNo: orderNo,
      });

      if (collision.hasCollision) {
        throw new AppError(ERROR_CODES.LOCK_CONFLICT, 400, collision.conflicts.join('; '));
      }

      // 写入 slot_bookings (pre_lock)
      await knex('slot_bookings').transacting(trx).insert({
        m_id: order.m_id,
        studio_id: order.studio_id,
        booking_date: fmtDate(order.order_date),
        start_time: startTime,
        end_time: endTime,
        order_no: orderNo,
        lock_type: 'pre_lock',
        // 兼容旧列
        time_slot: startTime,
        time_slot_end: endTime,
      });
    }

    await knex('orders').transacting(trx).where('order_no', orderNo)
      .update({ status: '定金待确认', payment_status: 'DEPOSIT_PAID', updated_at: knex.fn.now() });

    return { success: true, status: '定金待确认', paymentStatus: 'DEPOSIT_PAID' };
  });
}

// ════════════════════════════════════════
//  摄影师确认锁 (pre_lock → hard_lock)
// ════════════════════════════════════════

async function confirmLock(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.m_id !== mId) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);
  if (order.status !== '已付定金') {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '仅已付定金状态可确认锁定');
  }

  await knex.transaction(async (trx) => {
    await knex('slot_bookings').transacting(trx)
      .where({ order_no: orderNo, lock_type: 'pre_lock' })
      .update({ lock_type: 'hard_lock' });

    await knex('orders').transacting(trx).where('order_no', orderNo)
      .update({ status: '已确认锁定', updated_at: knex.fn.now() });
  });

  return { success: true, status: '已确认锁定' };
}

// ════════════════════════════════════════
//  查询占用时间 (V2 — 闭合时间块)
// ════════════════════════════════════════

async function getBookedTimesV2(mId, studioId, date, excludeOrderNo = '') {
  // 无 studioId 时查询该商户下所有项目的时段
  // ★ JOIN orders 表，排除已取消/已退款的订单，确保被删/取消的订单立刻释放时段
  const slotQuery = knex('slot_bookings as sb')
    .join('orders as o', 'sb.order_no', 'o.order_no')
    .where({ 'sb.m_id': mId, 'sb.booking_date': date })
    .whereNotIn('o.status', ['已取消', '已退款取消'])
    .where('o.service_status', '!=', 'CANCELLED');
  if (studioId) slotQuery.where('sb.studio_id', studioId);

  const [bookedRows, restRows, studio] = await Promise.all([
    slotQuery.select('sb.start_time', 'sb.end_time', 'sb.lock_type', 'sb.order_no', 'sb.studio_id'),
    studioId ? studioRepo.findRestSlots(studioId) : Promise.resolve([]),
    studioId ? studioRepo.findByIdAndMerchant(studioId, mId) : Promise.resolve(null),
  ]);

  // 获取该商户所有项目的 rest 时间，用于前端拆分拍摄/休息段
  const studios = studioId
    ? [await studioRepo.findByIdAndMerchant(studioId, mId)]
    : await knex('studios').where({ m_id: mId, is_deleted: false }).select('id', 'interval_rest_time');
  const restMap = {};
  for (const s of studios) {
    if (s) restMap[s.id] = s.interval_rest_time || 0;
  }

  let bookedRanges = bookedRows.map(r => ({
    start: typeof r.start_time === 'string' ? r.start_time.slice(0, 5) : r.start_time,
    end: typeof r.end_time === 'string' ? r.end_time.slice(0, 5) : r.end_time,
    lockType: r.lock_type,
    orderNo: r.order_no,
    restMinutes: restMap[r.studio_id] || 0,  // 对应项目的休息时间
  }));

  // 改期场景：剔除当前订单自身占用的时段，避免"自己和自己冲突"
  if (excludeOrderNo) {
    bookedRanges = bookedRanges.filter(b => b.orderNo !== excludeOrderNo);
  }

  const restRanges = restRows.map(r => ({
    start: typeof r.start_time === 'string' ? r.start_time.slice(0, 5) : r.start_time,
    end: typeof r.end_time === 'string' ? r.end_time.slice(0, 5) : r.end_time,
  }));

  // 计算可用间隙
  const baseStart = studio?.base_start_time
    ? (typeof studio.base_start_time === 'string' ? studio.base_start_time.slice(0, 5) : studio.base_start_time)
    : '09:00';
  const baseEnd = studio?.base_end_time
    ? (typeof studio.base_end_time === 'string' ? studio.base_end_time.slice(0, 5) : studio.base_end_time)
    : '21:00';

  const allBlocked = [...restRanges, ...bookedRanges.map(b => ({ start: b.start, end: b.end }))];
  allBlocked.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  const availableGaps = [];
  let cursor = baseStart;
  for (const block of allBlocked) {
    if (timeToMinutes(block.start) > timeToMinutes(cursor)) {
      availableGaps.push({ start: cursor, end: block.start });
    }
    if (timeToMinutes(block.end) > timeToMinutes(cursor)) {
      cursor = block.end;
    }
  }
  if (timeToMinutes(cursor) < timeToMinutes(baseEnd)) {
    availableGaps.push({ start: cursor, end: baseEnd });
  }

  return {
    bookedRanges,
    restRanges,
    availableGaps,
    baseStartTime: baseStart,
    baseEndTime: baseEnd,
  };
}

// ════════════════════════════════════════
//  通用函数 (管理端/用户端)
// ════════════════════════════════════════

async function getOrders(mId, filters = {}) {
  const page = Math.max(1, parseInt(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(filters.pageSize) || 20));

  const normalizedFilters = { ...filters };
  if (filters.status) normalizedFilters.status = normalizeStatus(filters.status);

  const [result, stats] = await Promise.all([
    orderRepo.findByMerchantPaginated(mId, normalizedFilters, page, pageSize),
    orderRepo.getStatsByMerchant(mId),
  ]);
  const list = [];
  for (const row of result.rows) {
    try {
      list.push(mapDTO(row));
    } catch (err) {
      logger.error('getOrders mapDTO error for order %s: %s', row.order_no, err.message);
    }
  }

  return {
    list,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    stats,
  };
}

async function getMyOrders(mId, deviceId) {
  const rows = await orderRepo.findByDevice(mId, deviceId);
  const list = [];
  for (const row of rows) {
    try {
      list.push(mapDTO(row));
    } catch (err) {
      logger.error('getMyOrders mapDTO error for order %s: %s', row.order_no, err.message);
    }
  }
  return list;
}

/** JWT 用户查订单 — userId + mId 双重隔离 */
async function getMyOrdersByUser(mId, userId) {
  const rows = await orderRepo.findByUser(mId, userId);
  const list = [];
  for (const row of rows) {
    try {
      list.push(mapDTO(row));
    } catch (err) {
      logger.error('getMyOrdersByUser mapDTO error for order %s: %s', row.order_no, err.message);
    }
  }
  return list;
}

const ALLOWED_TRANSITIONS = {
  '待支付':     ['定金待确认', '已付定金', '已取消', '退款审核中'],
  '定金待确认': ['已付定金', '已取消', '退款审核中'],
  '已付定金':   ['已确认锁定', '尾款待确认', '已取消', '退款审核中'],
  '已确认锁定': ['尾款待确认', '已结清', '退款审核中'],
  '尾款待确认': ['已结清', '退款审核中'],
  '已结清':     ['已完成拍摄', '退款审核中'],
  '未结清':     ['已完成拍摄', '退款审核中'],
  '退款审核中': ['已退款取消', '已付定金', '待支付', '尾款待确认', '已结清', '已确认锁定'],
};

async function updateStatus(orderNo, status, mId = null) {
  // 前端可能传英文状态，统一翻译为中文
  const normalizedStatus = normalizeStatus(status);

  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (mId && order.m_id !== mId) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);

  if (['已取消', '已退款取消', '已完成拍摄', '未结清'].includes(order.status)) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '该订单已结束，不能修改状态');
  }

  // ★ 硬核拦截：已确认订单不允许商家直接取消，需由客户端发起申请
  if (normalizedStatus === '已取消' && isConfirmedOrder(order)) {
    throw new AppError(
      ERROR_CODES.STATUS_NOT_ALLOWED, 403,
      '已确认定金的订单，商家无法主动取消，需由客户端发起申请',
    );
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(normalizedStatus)) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, `不允许从「${order.status}」直接变更为「${normalizedStatus}」`);
  }

  await orderRepo.updateStatusSimple(orderNo, normalizedStatus);

  if (normalizedStatus === '已取消') {
    await scheduleRepo.deleteSlotsByOrderNo(null, orderNo);
    notifyTimelineRelease(order.m_id, orderNo, order.studio_id);
  }

  return { success: true };
}

/** WebSocket 通知：时段已释放 */
function notifyTimelineRelease(mId, orderNo, studioId) {
  setImmediate(() => {
    try {
      const ws = require('../../shared/websocket').get();
      if (ws) {
        ws.notifyMerchant(mId, {
          type: 'timeline_release', orderNo, studioId,
          message: '订单时段已释放',
        });
      }
    } catch (_) { /* 静默 */ }
  });
}

/** 判断订单是否已被商家确认（不可直接取消） */
function isConfirmedOrder(order) {
  // ★ 定金待确认 ≠ 已确认（商家尚未核对流水）
  if (['定金待确认'].includes(order.status)) return false;
  return (
    ['已付定金', '已确认锁定', '尾款待确认', '已结清', '未结清'].includes(order.status) ||
    ['DEPOSIT_PAID', 'COMPLETED'].includes(order.payment_status) ||
    order.service_status === 'UNSETTLED'
  );
}

async function archiveOrder(orderNo, type, mId) {
  const normalizedType = normalizeStatus(type);

  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.m_id !== mId) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);

  // ★ 硬核拦截：已确认订单不允许商家直接归档为已取消
  if (normalizedType === '已取消' && isConfirmedOrder(order)) {
    throw new AppError(
      ERROR_CODES.STATUS_NOT_ALLOWED, 403,
      '已确认定金的订单，商家无法主动取消，需由客户端发起申请',
    );
  }

  const validFrom = {
    '已完成拍摄': ['已结清', '未结清', '已确认锁定'],
    '已取消':     ['待支付', '已付定金', '尾款待确认'],
    '已退款取消': ['退款审核中'],
  };
  const allowed = validFrom[normalizedType] || [];
  if (!allowed.includes(order.status)) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, `不允许从「${order.status}」归档为「${normalizedType}」`);
  }

  await orderRepo.updateStatusSimple(orderNo, normalizedType);

  if (['已取消', '已退款取消'].includes(normalizedType)) {
    await scheduleRepo.deleteSlotsByOrderNo(null, orderNo);
    notifyTimelineRelease(order.m_id, orderNo, order.studio_id);
  }

  return { success: true };
}

async function payFinal(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (!['已付定金', '已确认锁定'].includes(order.status)) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '当前状态不可支付尾款');
  }
  await orderRepo.updateStatusSimple(orderNo, '尾款待确认');
  return { success: true, status: '尾款待确认' };
}

async function getTodayStats(mId) {
  const row = await orderRepo.getTodayStats(mId);
  return { count: parseInt(row?.count) || 0, revenue: parseFloat(row?.revenue) || 0 };
}

async function getOrderDetail(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.m_id !== mId) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);
  return mapDTO(order);
}

// ════════════════════════════════════════
//  状态机 — 新三维状态字段
// ════════════════════════════════════════

/** 支付状态有效转换 */
const PAYMENT_TRANSITIONS = {
  PENDING_DEPOSIT: ['DEPOSIT_PAID', 'REFUNDED'],
  DEPOSIT_PAID:    ['COMPLETED', 'REFUNDED'],
  COMPLETED:       ['REFUNDED'],
  REFUNDED:        [],
};

/** 服务状态有效转换 */
const SERVICE_TRANSITIONS = {
  UPCOMING:  ['UNSETTLED', 'FULFILLED', 'CANCELLED'],
  UNSETTLED: ['FULFILLED'],
  FULFILLED: [],
  CANCELLED: [],
};

/** 申请状态有效转换 */
const APPLICATION_TRANSITIONS = {
  NONE:                  ['RESCHEDULE_REQUESTED', 'CANCEL_REQUESTED'],
  RESCHEDULE_REQUESTED:  ['NONE'],
  CANCEL_REQUESTED:      ['NONE'],
};

function validateTransition(transitions, from, to, label) {
  const allowed = transitions[from] || [];
  if (!allowed.includes(to)) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400,
      `${label}: 不允许从「${from}」直接变更为「${to}」`);
  }
}

// ════════════════════════════════════════
//  状态变更 API
// ════════════════════════════════════════

/** 确认收到定金 (管理员操作) — 幂等 + 升级锁 */
async function confirmDepositPaid(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);

  // 幂等：已经是已确认状态
  if (order.status === '已付定金' || order.status === '已确认锁定' || order.status === '已结清') {
    return { success: true, paymentStatus: order.payment_status, status: order.status };
  }

  // 来源必须是「待支付」或「定金待确认」（客户端已付款但商家未核对）
  if (order.status !== '待支付' && order.status !== '定金待确认') {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400,
      `不允许从「${order.status}」确认定金，请先由客户端完成支付`);
  }

  await knex.transaction(async (trx) => {
    await knex('orders').transacting(trx).where('order_no', orderNo).update({
      payment_status: 'DEPOSIT_PAID',
      status: '已付定金',
      updated_at: knex.fn.now(),
    });
    // ★ 升级锁：pre_lock → hard_lock（商家确认后时段正式锁定）
    await knex('slot_bookings').transacting(trx)
      .where({ order_no: orderNo, lock_type: 'pre_lock' })
      .update({ lock_type: 'hard_lock' });
  });
  return { success: true, paymentStatus: 'DEPOSIT_PAID', status: '已付定金' };
}

/** 未结清 → 确认结清 (管理员收到尾款后操作) */
async function confirmSettled(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.service_status !== 'UNSETTLED') {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '仅未结清状态的订单可执行此操作');
  }

  await knex('orders').where('order_no', orderNo).update({
    service_status: 'FULFILLED',
    payment_status: 'COMPLETED',
    status: '已完成拍摄',
    updated_at: knex.fn.now(),
  });
  return { success: true, serviceStatus: 'FULFILLED', paymentStatus: 'COMPLETED', status: '已完成拍摄' };
}

/** 确认尾款结清 (管理员操作) — 幂等 */
async function confirmCompleted(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);

  // 幂等：已经结清，只需同步旧 status 字段
  if (order.payment_status === 'COMPLETED') {
    if (order.status !== '已结清') {
      await knex('orders').where('order_no', orderNo).update({
        status: '已结清',
        updated_at: knex.fn.now(),
      });
    }
    return { success: true, paymentStatus: 'COMPLETED', status: order.status };
  }

  validateTransition(PAYMENT_TRANSITIONS, order.payment_status, 'COMPLETED', '支付状态');

  await knex('orders').where('order_no', orderNo).update({
    payment_status: 'COMPLETED',
    status: '已结清',
    updated_at: knex.fn.now(),
  });
  return { success: true, paymentStatus: 'COMPLETED', status: '已结清' };
}

/** 标记服务已完成 → 根据尾款状态分流 */
async function markFulfilled(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);

  const allowedFrom = ['UPCOMING', 'UNSETTLED', null];
  if (!allowedFrom.includes(order.service_status)) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400,
      `服务状态: 不允许从「${order.service_status || 'NONE'}」直接标记完成`);
  }

  // ★ 核心分流：尾款是否已结清
  const isPaymentSettled =
    order.payment_status === 'COMPLETED' ||
    order.status === '已结清' ||
    (order.deposit_amount > 0 && order.total_price > 0 && order.deposit_amount >= order.total_price);

  if (isPaymentSettled) {
    // 尾款已付 → 直接完成
    await knex('orders').where('order_no', orderNo).update({
      service_status: 'FULFILLED',
      status: '已完成拍摄',
      updated_at: knex.fn.now(),
    });
    return { success: true, serviceStatus: 'FULFILLED', status: '已完成拍摄' };
  }

  // 尾款未付 → 标记未结清
  await knex('orders').where('order_no', orderNo).update({
    service_status: 'UNSETTLED',
    status: '未结清',
    updated_at: knex.fn.now(),
  });
  return { success: true, serviceStatus: 'UNSETTLED', status: '未结清' };
}

/** 用户发起改期申请 */
async function requestReschedule(orderNo, deviceId, requestedNewTime) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.user_device_id !== deviceId) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);
  validateTransition(APPLICATION_TRANSITIONS, order.application_status, 'RESCHEDULE_REQUESTED', '申请状态');

  await knex('orders').where('order_no', orderNo).update({
    application_status: 'RESCHEDULE_REQUESTED',
    requested_new_time: requestedNewTime || null,
    updated_at: knex.fn.now(),
  });
  return { success: true, applicationStatus: 'RESCHEDULE_REQUESTED' };
}

/** 管理员审批改期（通过 → 更新订单时间 + 释放旧 slot + 锁定新 slot） */
async function approveReschedule(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  validateTransition(APPLICATION_TRANSITIONS, order.application_status, 'NONE', '申请状态');

  const newTime = order.requested_new_time;

  logger.info('[approveReschedule] 修改前时间: ' + JSON.stringify({
    booking_start_time: order.booking_start_time,
    booking_end_time: order.booking_end_time,
    requested_new_time: order.requested_new_time,
    application_status: order.application_status,
  }));

  if (newTime) {
    const parts = newTime.split('-').map(s => s.trim());
    const newStart = parts[0] || '';
    const newEnd = parts[1] || '';

    if (newStart && newEnd) {
      return knex.transaction(async (trx) => {
        // 1. 更新订单自身的时间字段
        await knex('orders').transacting(trx).where('order_no', orderNo).update({
          booking_start_time: newStart,
          booking_end_time: newEnd,
          application_status: 'NONE',
          requested_new_time: null,
          updated_at: knex.fn.now(),
        });

        // 2. 释放旧时段 + 锁定新时段（原子替换 slot_bookings）
        await knex('slot_bookings').transacting(trx).where('order_no', orderNo).del();
        await knex('slot_bookings').transacting(trx).insert({
          m_id: order.m_id,
          studio_id: order.studio_id,
          booking_date: typeof order.order_date === 'string'
            ? order.order_date.slice(0, 10)
            : (order.order_date instanceof Date
              ? order.order_date.getFullYear() + '-' + String(order.order_date.getMonth() + 1).padStart(2, '0') + '-' + String(order.order_date.getDate()).padStart(2, '0')
              : String(order.order_date || '').slice(0, 10)),
          start_time: newStart,
          end_time: newEnd,
          lock_type: 'hard_lock',
          order_no: orderNo,
          created_at: knex.fn.now(),
        });

        // 3. 回读验证
        const updated = await knex('orders').transacting(trx).where('order_no', orderNo)
          .select('booking_start_time', 'booking_end_time', 'application_status', 'requested_new_time')
          .first();

        logger.info('[approveReschedule] 修改后时间: ' + JSON.stringify({
          booking_start_time: updated.booking_start_time,
          booking_end_time: updated.booking_end_time,
          application_status: updated.application_status,
          requested_new_time: updated.requested_new_time,
        }));

        return { success: true, applicationStatus: 'NONE' };
      });
    }
  }

  // 无新时间：仅清除申请状态
  await knex('orders').where('order_no', orderNo).update({
    application_status: 'NONE',
    requested_new_time: null,
    updated_at: knex.fn.now(),
  });

  logger.info('[approveReschedule] 无新时间，仅清除申请状态');
  return { success: true, applicationStatus: 'NONE' };
}

/** 管理员拒绝改期 */
async function rejectReschedule(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  validateTransition(APPLICATION_TRANSITIONS, order.application_status, 'NONE', '申请状态');

  await knex('orders').where('order_no', orderNo).update({
    application_status: 'NONE',
    requested_new_time: null,
    updated_at: knex.fn.now(),
  });
  return { success: true, applicationStatus: 'NONE' };
}

/** 用户发起取消申请 */
async function requestCancel(orderNo, deviceId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.user_device_id !== deviceId) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);
  validateTransition(APPLICATION_TRANSITIONS, order.application_status, 'CANCEL_REQUESTED', '申请状态');

  await knex('orders').where('order_no', orderNo).update({
    application_status: 'CANCEL_REQUESTED',
    updated_at: knex.fn.now(),
  });
  return { success: true, applicationStatus: 'CANCEL_REQUESTED' };
}

/** 管理员审批取消（通过 → 取消订单 + 释放时段） */
async function approveCancel(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  validateTransition(APPLICATION_TRANSITIONS, order.application_status, 'NONE', '申请状态');

  // 同时更新新旧状态字段，确保与「商家直接取消」效果完全一致
  await knex('orders').where('order_no', orderNo).update({
    application_status: 'NONE',
    service_status: 'CANCELLED',
    payment_status: 'REFUNDED',
    status: '已退款取消',           // ← 旧 status 字段同步
    updated_at: knex.fn.now(),
  });
  await scheduleRepo.deleteSlotsByOrderNo(null, orderNo);
  notifyTimelineRelease(order.m_id, orderNo, order.studio_id);
  return { success: true, serviceStatus: 'CANCELLED', paymentStatus: 'REFUNDED' };
}

/** 管理员拒绝取消申请 */
async function rejectCancel(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  validateTransition(APPLICATION_TRANSITIONS, order.application_status, 'NONE', '申请状态');

  await knex('orders').where('order_no', orderNo).update({
    application_status: 'NONE',
    updated_at: knex.fn.now(),
  });
  return { success: true, applicationStatus: 'NONE' };
}

// ─── DTO ───

function mapDTO(row) {
  return {
    id: row.id,
    orderNo: row.order_no,
    mId: row.m_id,
    studioId: row.studio_id,
    styleId: row.style_id,
    studioTitle: row.studio_title,
    serviceMode: row.service_mode,
    optType: row.opt_type,
    modelExperience: row.model_experience,
    roleName: row.role_name,
    contactType: row.contact_type || '',
    contactValue: row.contact_value || '',
    contactNote: row.contact_note,
    date: fmtDate(row.order_date),
    bookingStartTime: fmtTime(row.booking_start_time),
    bookingEndTime: fmtTime(row.booking_end_time),
    times: safeJson(row.time_slots, []),
    timesEnd: safeJson(row.time_slots_end, []),
    isPackageOrder: row.is_package_order,
    totalPrice: row.total_price,
    depositAmount: row.deposit_amount,
    depositRatio: row.deposit_ratio,
    selectedAddonIds: safeJson(row.selected_addon_ids, []),
    addonTotal: Number(row.addon_total || 0),
    extraItems: safeJson(row.extra_items, []),
    contact: row.contact_info,
    peopleCount: row.people_count,
    photoCount: row.photo_count,
    status: row.status,
    // 新增状态机字段
    paymentStatus: row.payment_status || 'PENDING_DEPOSIT',
    serviceStatus: row.service_status || 'UPCOMING',
    applicationStatus: row.application_status || 'NONE',
    requestedNewTime: row.requested_new_time || '',
    userDeviceId: row.user_device_id,
    refundText: row.refund_text,
    refundImgUrl: row.refund_img_url,
    rejectReason: row.reject_reason,
    originalStatus: row.original_status || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeJson(val, fb) {
  if (!val) return fb;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fb; }
}
function fmtDate(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  try { const d = new Date(v); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); } catch { return String(v); }
}
function fmtTime(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 5);
  return v;
}

// ════════════════════════════════════════
//  恢复已取消订单
// ════════════════════════════════════════

async function restoreOrder(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);

  // 仅允许恢复已取消/已退款的订单
  const isCancelled =
    order.status === '已取消' || order.status === '已退款取消' ||
    order.service_status === 'CANCELLED' || order.payment_status === 'REFUNDED';
  if (!isCancelled) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '仅可恢复已取消的订单');
  }

  // 获取原始时间段
  const startTime = typeof order.booking_start_time === 'string'
    ? order.booking_start_time.slice(0, 5) : (order.booking_start_time || '');
  const endTime = typeof order.booking_end_time === 'string'
    ? order.booking_end_time.slice(0, 5) : (order.booking_end_time || '');
  if (!startTime || !endTime) {
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '订单缺少原始时间段信息，无法恢复');
  }

  // ★ 核心安全检测：原时间段是否已被别人占用
  const rawDate = order.order_date;
  let date;
  if (typeof rawDate === 'string') {
    date = rawDate.slice(0, 10);
  } else if (rawDate instanceof Date) {
    date = rawDate.getFullYear() + '-' + String(rawDate.getMonth() + 1).padStart(2, '0') + '-' + String(rawDate.getDate()).padStart(2, '0');
  } else {
    date = String(rawDate || '').slice(0, 10);
  }

  const existingSlots = await knex('slot_bookings')
    .where({ studio_id: order.studio_id, booking_date: date })
    .whereNot('order_no', orderNo)  // 排除自身（如果还有残留）
    .select('start_time', 'end_time');

  // 手动冲突检测：原时间段是否已被别人占用
  let hasConflict = false;
  const sMin = timeToMinutes(startTime);
  const eMin = timeToMinutes(endTime);
  for (const s of existingSlots) {
    const bs = timeToMinutes(typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time);
    const be = timeToMinutes(typeof s.end_time === 'string' ? s.end_time.slice(0, 5) : s.end_time);
    if (sMin < be && eMin > bs) {
      hasConflict = true;
      break;
    }
  }

  if (hasConflict) {
    throw new AppError(
      ERROR_CODES.LOCK_CONFLICT, 409,
      '该订单原定时间段已被其他预约占用，无法直接恢复。请重新发起预约或联系用户改期。'
    );
  }

  // ★ 原子操作：恢复状态 + 重新锁定时段
  return knex.transaction(async (trx) => {
    // 恢复订单状态
    await knex('orders').transacting(trx).where('order_no', orderNo).update({
      status: order.original_status || '已付定金',
      service_status: 'UPCOMING',
      application_status: 'NONE',
      payment_status: order.deposit_amount > 0 ? 'DEPOSIT_PAID' : 'PENDING_DEPOSIT',
      requested_new_time: null,
      updated_at: knex.fn.now(),
    });

    // 重新写入时段锁定
    const lockType = order.status === '已退款取消' ? 'pre_lock' : 'hard_lock';
    await knex('slot_bookings').transacting(trx).insert({
      m_id: order.m_id,
      studio_id: order.studio_id,
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
      lock_type: lockType,
      order_no: orderNo,
      created_at: knex.fn.now(),
    });

    return { success: true, serviceStatus: 'UPCOMING', paymentStatus: order.deposit_amount > 0 ? 'DEPOSIT_PAID' : 'PENDING_DEPOSIT' };
  });
}

// ════════════════════════════════════════
//  永久删除订单（仅限已取消状态）
// ════════════════════════════════════════

async function deleteOrder(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order || order.m_id !== mId) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);

  const isCancelled =
    order.status === '已取消' || order.status === '已退款取消' ||
    order.service_status === 'CANCELLED' || order.payment_status === 'REFUNDED';
  if (!isCancelled) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '仅可删除已取消/已退款的订单');
  }

  return knex.transaction(async (trx) => {
    await scheduleRepo.deleteSlotsByOrderNo(trx, orderNo);
    await orderRepo.deleteByOrderNo(trx, orderNo);
  }).then(() => {
    notifyTimelineRelease(order.m_id, orderNo, order.studio_id);
  });
}

// ════════════════════════════════════════
//  批量清除已完成订单
// ════════════════════════════════════════

async function clearCompletedOrders(mId) {
  // 先查出所有要删的已完成订单号，用于清理 slot_bookings
  const completedOrders = await knex('orders')
    .where({ m_id: mId, status: '已完成拍摄' })
    .select('order_no');

  const orderNos = completedOrders.map(o => o.order_no);

  return knex.transaction(async (trx) => {
    if (orderNos.length > 0) {
      await knex('slot_bookings').transacting(trx)
        .whereIn('order_no', orderNos)
        .del();
    }
    const result = await knex('orders').transacting(trx)
      .where({ m_id: mId, status: '已完成拍摄' })
      .del();
    return { deleted: result };
  });
}

// ════════════════════════════════════════
//  Excel 批量导入订单
// ════════════════════════════════════════

async function importOrders(filePath, originalName, mId) {
  const excelHelper = require('../../shared/utils/excelHelper');
  const fs = require('fs');
  const ext = require('path').extname(originalName).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) {
    fs.unlink(filePath, () => {});
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '仅支持 .xlsx 或 .xls 格式');
  }

  let parseResult;
  try { parseResult = excelHelper.parseOrderImportExcel(filePath); }
  finally { fs.unlink(filePath, () => {}); }

  const { validRows, errors } = parseResult;
  if (errors.length > 0) {
    const msg = errors.map(e => `第${e.row}行: ${e.errors.join('; ')}`).join(' | ');
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, `数据格式错误 — ${msg}`);
  }
  if (validRows.length === 0) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '无有效数据行');

  // 加载所有项目配置（按名称匹配）
  const allStudios = await knex('studios').where({ m_id: mId, is_deleted: false });
  const allStyles = await knex('styles').where('m_id', mId);

  // ★ 阶段 1：匹配项目、计算占用时间、收集冲突检测数据
  const importItems = [];
  for (const row of validRows) {
    const studio = allStudios.find(s => s.title.trim().toLowerCase() === row.projectName.toLowerCase());
    if (!studio) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, `第${row.rowNum}行: 项目「${row.projectName}」不存在`);

    let style = null;
    if (row.styleName) {
      style = allStyles.find(s => s.style_name.trim().toLowerCase() === row.styleName.toLowerCase());
      if (!style) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, `第${row.rowNum}行: 样式「${row.styleName}」不存在`);
    }

    // 计算占用区间
    const shotTime = style ? (style.single_shot_time || studio.single_shot_time || 60) : (studio.single_shot_time || 60);
    const restTime = studio.interval_rest_time || 0;
    const totalMin = shotTime + restTime;
    const startMin = timeToMinutes(row.startTime);
    const endTime = `${String(Math.floor((startMin + totalMin) / 60) % 24).padStart(2, '0')}:${String((startMin + totalMin) % 60).padStart(2, '0')}`;

    // 营业时间校验
    const baseStart = (typeof studio.base_start_time === 'string' ? studio.base_start_time.slice(0, 5) : null) || '09:00';
    const baseEnd = (typeof studio.base_end_time === 'string' ? studio.base_end_time.slice(0, 5) : null) || '21:00';
    if (startMin < timeToMinutes(baseStart) || startMin + totalMin > timeToMinutes(baseEnd)) {
      throw new AppError(ERROR_CODES.PARAM_INVALID, 400, `第${row.rowNum}行: 时段 ${row.startTime}-${endTime} 超出营业时间 ${baseStart}-${baseEnd}`);
    }

    importItems.push({
      ...row,
      studioId: studio.id,
      studioTitle: studio.title,
      styleId: style?.id || null,
      shotTime, restTime, totalMin,
      startTime: row.startTime,
      endTime,
    });
  }

  // ★ 阶段 2：冲突检测
  const conflictErrors = [];
  for (const item of importItems) {
    const existingSlots = await knex('slot_bookings')
      .where({ studio_id: item.studioId, booking_date: item.date })
      .select('start_time', 'end_time', 'order_no');

    let hasConflict = false;
    let conflictWith = '';
    const sMin = timeToMinutes(item.startTime);
    const eMin = timeToMinutes(item.endTime);
    for (const s of existingSlots) {
      const bs = timeToMinutes(typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time);
      const be = timeToMinutes(typeof s.end_time === 'string' ? s.end_time.slice(0, 5) : s.end_time);
      if (sMin < be && eMin > bs) {
        hasConflict = true;
        conflictWith = `(${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)})`;
        break;
      }
    }
    if (hasConflict) {
      conflictErrors.push(`第${item.rowNum}行「${item.customerName}」${item.startTime}-${item.endTime} 与已有订单${conflictWith}冲突`);
    }
  }

  if (conflictErrors.length > 0) {
    throw new AppError(
      ERROR_CODES.LOCK_CONFLICT, 409,
      `导入失败！以下订单与当天已有预约冲突，请调整时间后重新导入：\n${conflictErrors.join('\n')}`
    );
  }

  // ★ 阶段 3：批量写入
  return knex.transaction(async (trx) => {
    let successCount = 0;
    for (const item of importItems) {
      const orderNo = generateOrderNo();
      await knex('orders').transacting(trx).insert({
        order_no: orderNo, m_id: mId, studio_id: item.studioId,
        style_id: item.styleId || null,
        opt_type: 'single', order_date: item.date,
        booking_start_time: item.startTime, booking_end_time: item.endTime,
        role_name: item.customerName, contact_note: item.customerPhone,
        contact_info: item.customerPhone,
        total_price: 0, deposit_amount: 0, deposit_ratio: 30,
        studio_title: item.studioTitle, service_mode: 'studio',
        time_slots: JSON.stringify([item.startTime]),
        time_slots_end: JSON.stringify([item.endTime]),
        people_count: 1, photo_count: 1,
        status: '待支付', user_device_id: 'import_' + Date.now(),
      });

      await knex('slot_bookings').transacting(trx).insert({
        m_id: mId, studio_id: item.studioId,
        booking_date: item.date, start_time: item.startTime,
        end_time: item.endTime, lock_type: 'pre_lock',
        order_no: orderNo, created_at: knex.fn.now(),
      });
      successCount++;
    }

    return {
      success: true,
      total: validRows.length,
      successCount,
      failCount: 0,
      message: `成功导入 ${successCount} 条订单`,
    };
  });
}

module.exports = {
  createOrder, createOrderV2,
  payDeposit, payFinal,
  confirmLock,
  getBookedTimesV2,
  getOrders, getMyOrders, getMyOrdersByUser, updateStatus, archiveOrder,
  getTodayStats, getOrderDetail,
  // 新状态机 API
  confirmDepositPaid, confirmCompleted, confirmSettled, markFulfilled,
  requestReschedule, approveReschedule, rejectReschedule,
  requestCancel, approveCancel, rejectCancel,
  restoreOrder,
  deleteOrder,
  clearCompletedOrders,
  importOrders,
};
