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

  console.log('====== [BUG DIAGNOSIS] findByMerchantPaginated 入口 ======');
  console.log('  mId:', mId, 'filters:', JSON.stringify(filters));

  // 状态过滤：兼容新旧字段 + NULL 安全
  const cancelStatuses = ['已取消', '已退款取消'];
  if (filters.status) {
    console.log('  filters.status:', filters.status);
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
  } else {
    // "全部"tab：不限制订单状态，展示所有订单（包括已取消/已退款）
    console.log('  filters.status: 空 → 走 "全部" 逻辑 (不限制状态)');
  }

  // ★ 打印最终 SQL
  console.log('====== [BUG DIAGNOSIS] 最终 COUNT SQL:', base.clone().count('* as total').toSQL().sql);
  console.log('====== [BUG DIAGNOSIS] 最终 COUNT bindings:', JSON.stringify(base.clone().count('* as total').toSQL().bindings));

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

function getStatsByMerchant(mId) {
  return knex(TABLE)
    .where('m_id', mId)
    .select('status')
    .then((rows) => {
      const active = rows.filter(r => !['已完成拍摄', '已取消', '已退款取消', '退款审核中'].includes(r.status)).length;
      const refunding = rows.filter(r => r.status === '退款审核中').length;
      const completed = rows.filter(r => ['已完成拍摄', '已取消', '已退款取消'].includes(r.status)).length;
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
  const today = new Date().toISOString().slice(0, 10);
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

module.exports = {
  create, findByOrderNo, findByMerchant, findByDevice,
  updateStatus, updateStatusSimple, updateDateTimes, updateRefundInfo, rejectRefund,
  findByMerchantPaginated, getStatsByMerchant, getTodayStats, updateRejectReason,
};
