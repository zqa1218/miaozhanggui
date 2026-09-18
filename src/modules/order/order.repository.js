const knex = require('../../shared/database/knex');

const TABLE = 'orders';

function create(trx, data) {
  return knex(TABLE).transacting(trx).insert(data);
}

function findByOrderNo(orderNo) {
  return knex(TABLE).where('order_no', orderNo).first();
}

function findByMerchant(mId, filters = {}) {
  let q = knex(TABLE).where('m_id', mId);
  if (filters.status) q = q.where('status', filters.status);
  if (filters.date) q = q.where('order_date', filters.date);
  if (filters.studioId) q = q.where('studio_id', filters.studioId);
  if (filters.search) q = q.where(function () {
    this.where('order_no', 'like', `%${filters.search}%`)
      .orWhere('contact_info', 'like', `%${filters.search}%`)
      .orWhere('role_name', 'like', `%${filters.search}%`)
      .orWhere('contact_note', 'like', `%${filters.search}%`);
  });
  return q
    .orderByRaw("COALESCE(booking_start_time, JSON_UNQUOTE(JSON_EXTRACT(time_slots, '$[0]'))) ASC")
    .orderBy('created_at', 'desc');
}

function findByMerchantPaginated(mId, filters = {}, page = 1, pageSize = 20) {
  let base = knex(TABLE).where('m_id', mId);

  // 状态过滤：兼容新旧字段 + NULL 安全
  const cancelStatuses = ['已取消', '已退款取消'];
  if (filters.status) {
    if (filters.status === 'CANCELLED_ANY') {
      base = base.where(function () {
        this.whereIn('status', cancelStatuses)
          .orWhere('service_status', 'CANCELLED')
          .orWhere('payment_status', 'REFUNDED');
      });
    } else {
      base = base.where('status', filters.status);
      if (!cancelStatuses.includes(filters.status)) {
        base = base.whereNotIn('status', cancelStatuses)
          .where(function () {
            this.where('service_status', '!=', 'CANCELLED')
              .orWhereNull('service_status');
          });
      }
    }
  }

  if (filters.startDate && filters.endDate) {
    base = base.where('order_date', '>=', filters.startDate)
               .where('order_date', '<=', filters.endDate);
  } else if (filters.date) {
    base = base.where('order_date', filters.date);
  }
  if (filters.studioId) base = base.where('studio_id', filters.studioId);
  if (filters.search) base = base.where(function () {
    this.where('order_no', 'like', `%${filters.search}%`)
      .orWhere('contact_info', 'like', `%${filters.search}%`)
      .orWhere('role_name', 'like', `%${filters.search}%`)
      .orWhere('contact_note', 'like', `%${filters.search}%`);
  });

  return Promise.all([
    base.clone().count('* as total').first(),
    base.clone()
      .orderByRaw("COALESCE(booking_start_time, JSON_UNQUOTE(JSON_EXTRACT(time_slots, '$[0]'))) ASC")
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]).then(([countRow, rows]) => ({
    total: parseInt(countRow.total) || 0,
    rows,
    page,
    pageSize,
  }));
}

function findByDevice(mId, deviceId) {
  return knex(TABLE)
    .where({ m_id: mId, user_device_id: deviceId })
    .orderBy('created_at', 'desc');
}

/** JWT 用户查订单 — userId + mId 双重隔离 */
function findByUser(mId, userId) {
  return knex(TABLE)
    .where({ m_id: mId, user_id: userId })
    .orderBy('created_at', 'desc');
}

/** JWT 用户分页查订单 — 可跨商户（不传 mId 则查全部归属） */
function findByUserPaginated(userId, { mId, status, page = 1, pageSize = 20 } = {}) {
  let base = knex(TABLE).where('user_id', userId);
  if (mId) base = base.where('m_id', mId);
  if (status) base = base.where('status', status);
  return Promise.all([
    base.clone().count('* as total').first(),
    base.clone()
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]).then(([countRow, rows]) => ({
    total: parseInt(countRow.total) || 0,
    rows,
    page,
    pageSize,
  }));
}

/** 幂等键查询 */
function findByIdempotencyKey(key) {
  if (!key) return Promise.resolve(null);
  return knex(TABLE).where('idempotency_key', key).first();
}

// ─── 订单状态时间线 ───

function insertStatusLog(trx, data) {
  const q = knex('order_status_logs');
  return (trx ? q.transacting(trx) : q).insert(data);
}

function findStatusLogsByOrderNo(orderNo) {
  return knex('order_status_logs')
    .where('order_no', orderNo)
    .orderBy('created_at', 'asc')
    .orderBy('id', 'asc');
}

// ─── 支付流水 ───

function insertPayment(trx, data) {
  const q = knex('order_payments');
  return (trx ? q.transacting(trx) : q).insert(data);
}

function findPaymentByType(orderNo, type, trx) {
  const q = knex('order_payments');
  return (trx ? q.transacting(trx) : q).where({ order_no: orderNo, type }).first();
}

function updatePayment(trx, id, data) {
  const q = knex('order_payments');
  return (trx ? q.transacting(trx) : q).where('id', id).update(data);
}

function findPaymentsByOrderNo(orderNo) {
  return knex('order_payments')
    .where('order_no', orderNo)
    .orderBy('created_at', 'asc')
    .orderBy('id', 'asc');
}

function getStatsByMerchant(mId) {
  return knex(TABLE)
    .where('m_id', mId)
    .select('status')
    .then((rows) => {
      const ended = ['已完成拍摄', '已取消', '已退款取消'];
      const active = rows.filter(r => !ended.includes(r.status) && r.status !== '退款审核中').length;
      const refunding = rows.filter(r => r.status === '退款审核中').length;
      const completed = rows.filter(r => ended.includes(r.status)).length;
      return { active, refunding, completed };
    });
}

function updateStatus(trx, orderNo, status) {
  return knex(TABLE).transacting(trx).where('order_no', orderNo)
    .update({ status, updated_at: knex.fn.now() });
}

function updateStatusSimple(orderNo, status) {
  return knex(TABLE).where('order_no', orderNo)
    .update({ status, updated_at: knex.fn.now() });
}

function updateDateTimes(trx, orderNo, date, times, timesEnd) {
  const data = { order_date: date, time_slots: JSON.stringify(times), updated_at: knex.fn.now() };
  if (timesEnd !== undefined) data.time_slots_end = JSON.stringify(timesEnd);
  return knex(TABLE).transacting(trx).where('order_no', orderNo).update(data);
}

function updateRefundInfo(orderNo, text, imgUrl, originalStatus) {
  return knex(TABLE).where('order_no', orderNo)
    .update({ refund_text: text, refund_img_url: imgUrl, status: '退款审核中', original_status: originalStatus, updated_at: knex.fn.now() });
}

function rejectRefund(orderNo, reason) {
  return knex(TABLE).where('order_no', orderNo)
    .update({ reject_reason: reason, status: knex.raw('COALESCE(original_status, ?)', ['已付定金']), original_status: null, updated_at: knex.fn.now() });
}

function getTodayStats(mId) {
  // ★ 用本地时区取"今天"。原先用 toISOString() 是 UTC 日期，北京时间 00:00–08:00
  //   之间会取到昨天，「今日营收」卡片整晚显示的是前一天的数。
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return knex(TABLE)
    .where({ m_id: mId, order_date: today })
    .whereNotIn('status', ['已取消', '已退款取消'])
    .select(
      knex.raw('COUNT(*) as count'),
      knex.raw('COALESCE(SUM(total_price), 0) as revenue'),
    )
    .first();
}

function updateRejectReason(orderNo, reason) {
  return knex(TABLE).where('order_no', orderNo)
    .update({ reject_reason: reason, updated_at: knex.fn.now() });
}

function deleteByOrderNo(trx, orderNo) {
  const q = knex(TABLE).where('order_no', orderNo);
  return trx ? q.transacting(trx).del() : q.del();
}

function clearCompletedByMerchant(mId) {
  return knex(TABLE)
    .where({ m_id: mId, status: '已完成拍摄' })
    .del();
}

module.exports = {
  create, findByOrderNo, findByMerchant, findByDevice, findByUser,
  findByUserPaginated, findByIdempotencyKey,
  updateStatus, updateStatusSimple, updateDateTimes, updateRefundInfo, rejectRefund,
  findByMerchantPaginated, getStatsByMerchant, getTodayStats, updateRejectReason,
  deleteByOrderNo, clearCompletedByMerchant,
  insertStatusLog, findStatusLogsByOrderNo,
  insertPayment, findPaymentByType, updatePayment, findPaymentsByOrderNo,
};
