const knex = require('../../shared/database/knex');

const TABLE = 'orders';

/** 创建订单（事务内）*/
function create(trx, data) {
  return knex(TABLE).transacting(trx).insert(data);
}

/** 根据订单号查询 */
function findByOrderNo(orderNo) {
  return knex(TABLE).where('order_no', orderNo).first();
}

/** 商户全部订单 */
function findByMerchant(mId, filters = {}) {
  let q = knex(TABLE).where('m_id', mId);
  if (filters.status) q = q.where('status', filters.status);
  if (filters.date) q = q.where('order_date', filters.date);
  if (filters.search) q = q.where(function () {
    this.where('order_no', 'like', `%${filters.search}%`)
      .orWhere('contact_info', 'like', `%${filters.search}%`);
  });
  return q.orderBy('created_at', 'desc');
}

/** 商户订单（分页） */
function findByMerchantPaginated(mId, filters = {}, page = 1, pageSize = 20) {
  let base = knex(TABLE).where('m_id', mId);
  if (filters.status) base = base.where('status', filters.status);
  if (filters.date) base = base.where('order_date', filters.date);
  if (filters.search) base = base.where(function () {
    this.where('order_no', 'like', `%${filters.search}%`)
      .orWhere('contact_info', 'like', `%${filters.search}%`);
  });

  return Promise.all([
    base.clone().count('* as total').first(),
    base.clone().orderBy('created_at', 'desc').limit(pageSize).offset((page - 1) * pageSize),
  ]).then(([countRow, rows]) => ({
    total: parseInt(countRow.total) || 0,
    rows,
    page,
    pageSize,
  }));
}

/** 根据设备ID查找 */
function findByDevice(mId, deviceId) {
  return knex(TABLE)
    .where({ m_id: mId, user_device_id: deviceId })
    .orderBy('created_at', 'desc');
}

/** 订单统计 */
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

/** 更新订单状态 */
function updateStatus(trx, orderNo, status) {
  return knex(TABLE).transacting(trx).where('order_no', orderNo)
    .update({ status, updated_at: knex.fn.now() });
}

/** 更新订单状态（无事务） */
function updateStatusSimple(orderNo, status) {
  return knex(TABLE).where('order_no', orderNo)
    .update({ status, updated_at: knex.fn.now() });
}

/** 更新订单日期时段（改期用） */
function updateDateTimes(trx, orderNo, date, times) {
  return knex(TABLE).transacting(trx).where('order_no', orderNo)
    .update({ order_date: date, time_slots: JSON.stringify(times), updated_at: knex.fn.now() });
}

/** 更新退款信息 */
function updateRefundInfo(orderNo, text, imgUrl) {
  return knex(TABLE).where('order_no', orderNo)
    .update({ refund_text: text, refund_img_url: imgUrl, status: '退款审核中', updated_at: knex.fn.now() });
}

module.exports = {
  create, findByOrderNo, findByMerchant, findByDevice,
  updateStatus, updateStatusSimple, updateDateTimes, updateRefundInfo,
  findByMerchantPaginated, getStatsByMerchant,
};
