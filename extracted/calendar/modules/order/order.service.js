const knex = require('../../shared/database/knex');
const { AppError } = require('../../shared/errors/AppError');
const { ERROR_CODES } = require('../../shared/errors/errorCodes');
const { generateOrderNo } = require('../../shared/utils/orderNo');
const { calculate } = require('../../shared/utils/priceEngine');
const orderRepo = require('./order.repository');
const scheduleRepo = require('../schedule/schedule.repository');
const studioRepo = require('../studio/studio.repository');
const notificationRepo = require('../notification/notification.repository');

/**
 *   创建订单 —— 最核心接口
 */
async function createOrder(payload) {
  const studio = await studioRepo.findByIdAndMerchant(payload.studioId, payload.mId);
  if (!studio || studio.is_deleted) throw new AppError(ERROR_CODES.STUDIO_NOT_FOUND, 404);

  const orderNo = generateOrderNo();

  return knex.transaction(async (trx) => {
    // ① 检查包天冲突
    if (payload.isPackageOrder) {
      const pkg = await scheduleRepo.hasPackageDayBooking(payload.mId, payload.studioId, payload.date);
      if (pkg) throw new AppError(ERROR_CODES.FULL_DAY_BLOCKED, 400, '  该日已被包场  ');
    } else {
      const pkg = await scheduleRepo.hasPackageDayBooking(payload.mId, payload.studioId, payload.date);
      if (pkg) throw new AppError(ERROR_CODES.FULL_DAY_BLOCKED, 400, '  该日已被包场锁定  ');
    }

    // ② 检查不可接单时段
    const unavailList = await scheduleRepo.getUnavailableSlots(payload.mId, payload.studioId, payload.date);
    const unavailSet = new Set(unavailList.map((r) => r.time_slot));
    for (const t of payload.times) {
      if (unavailSet.has(t)) throw new AppError(ERROR_CODES.UNAVAILABLE_SLOT, 400, `  时段 ${t} 商家不接单  `);
    }

    // ③ 检查时段冲突（行级锁）
    for (const t of payload.times) {
      const existing = await knex('slot_bookings')
        .transacting(trx)
        .where({ m_id: payload.mId, studio_id: payload.studioId, booking_date: payload.date, time_slot: t })
        .forUpdate()
        .first();

      if (existing) {
        throw new AppError(ERROR_CODES.SLOT_CONFLICT, 400, `  时段 ${t} 已被预定  `);
      }

      // photo_time 模式检查上限
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
          throw new AppError(ERROR_CODES.PHOTO_LIMIT_EXCEEDED, 400, `  时段 ${t} 接单数已达上限  `);
        }
      }
    }

    // ④ 写入占位
    for (const t of payload.times) {
      await scheduleRepo.insertSlot(trx, {
        m_id: payload.mId,
        studio_id: payload.studioId,
        booking_date: payload.date,
        time_slot: t,
        order_no: orderNo,
        is_package_day: payload.isPackageOrder || false,
        booking_count: 1,
      });
    }

    // ⑤ 写入订单
    await orderRepo.create(trx, {
      order_no: orderNo,
      m_id: payload.mId,
      studio_id: payload.studioId,
      studio_title: payload.studioTitle,
      service_mode: payload.serviceMode,
      order_date: payload.date,
      time_slots: JSON.stringify(payload.times),
      is_package_order: payload.isPackageOrder || false,
      total_price: payload.totalPrice,
      deposit_amount: payload.depositAmount,
      deposit_ratio: payload.depositRatio,
      contact_info: payload.contact,
      people_count: payload.peopleCount || 1,
      photo_count: payload.photoCount || null,
      status: '待支付',
      user_device_id: payload.userDeviceId,
    });

    // ⑥ 异步推送通知
    setImmediate(async () => {
      try {
        await notificationRepo.insert({
          m_id: payload.mId,
          title: '  新订单通知',
          content: `项目:${payload.studioTitle} / 日期:${payload.date} / 时段:${payload.times.join(',')}`,
          type: 'info',
          order_no: orderNo,
        });
      } catch (_) { /* 静默失败 */ }
    });

    return { orderNo, totalPrice: payload.totalPrice, depositAmount: payload.depositAmount };
  });
}

/** 管理端订单列表 */
async function getOrders(mId, filters = {}) {
  const page = Math.max(1, parseInt(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(filters.pageSize) || 20));
  const [result, stats] = await Promise.all([
    orderRepo.findByMerchantPaginated(mId, filters, page, pageSize),
    orderRepo.getStatsByMerchant(mId),
  ]);
  return {
    list: result.rows.map(mapDTO),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    stats,
  };
}

/** 用户端我的订单 */
async function getMyOrders(mId, deviceId) {
  const rows = await orderRepo.findByDevice(mId, deviceId);
  return rows.map(mapDTO);
}

/** 更新状态 */
async function updateStatus(orderNo, status, mId = null) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (mId && order.m_id !== mId) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);

  // 已取消/已退款的不能再改
  if (['已取消', '已退款取消'].includes(order.status)) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '  该订单已取消，不能修改状态  ');
  }

  await orderRepo.updateStatusSimple(orderNo, status);

  // 如果取消，释放时段
  if (status === '已取消') {
    await scheduleRepo.deleteSlotsByOrderNo(null, orderNo); // 无事务也行
  }

  return { success: true };
}

/** 归档 */
async function archiveOrder(orderNo, type, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.m_id !== mId) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);

  await orderRepo.updateStatusSimple(orderNo, type);

  // 取消类释放时段
  if (['已取消', '已退款取消'].includes(type)) {
    await scheduleRepo.deleteSlotsByOrderNo(null, orderNo);
  }

  return { success: true };
}

function mapDTO(row) {
  return {
    id: row.id,
    orderNo: row.order_no,
    mId: row.m_id,
    studioId: row.studio_id,
    studioTitle: row.studio_title,
    serviceMode: row.service_mode,
    date: row.order_date,
    times: safeJson(row.time_slots, []),
    isPackageOrder: row.is_package_order,
    totalPrice: row.total_price,
    depositAmount: row.deposit_amount,
    depositRatio: row.deposit_ratio,
    contact: row.contact_info,
    peopleCount: row.people_count,
    photoCount: row.photo_count,
    status: row.status,
    userDeviceId: row.user_device_id,
    refundText: row.refund_text,
    refundImgUrl: row.refund_img_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeJson(val, fb) {
  if (!val) return fb;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fb; }
}

module.exports = { createOrder, getOrders, getMyOrders, updateStatus, archiveOrder };
