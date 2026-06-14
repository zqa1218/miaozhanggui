const knex = require('../../shared/database/knex');

const TABLE = 'notifications';

function insert(data) {
  return knex(TABLE).insert(data);
}

function findByMerchant(mId) {
  return knex(TABLE).where('m_id', mId).orderBy('created_at', 'desc').limit(100);
}

function countUnread(mId) {
  return knex(TABLE).where({ m_id: mId, is_read: false }).count('id as count').first();
}

function markAsRead(mId, ids) {
  if (ids && ids.length > 0) {
    return knex(TABLE).whereIn('id', ids).where('m_id', mId).update({ is_read: true });
  }
  return knex(TABLE).where({ m_id: mId, is_read: false }).update({ is_read: true });
}

/** 根据订单号列表查询通知 */
function findByOrderNos(mId, orderNos) {
  if (!orderNos || orderNos.length === 0) return [];
  return knex(TABLE)
    .where('m_id', mId)
    .whereIn('order_no', orderNos)
    .orderBy('created_at', 'desc')
    .limit(50);
}

module.exports = { insert, findByMerchant, countUnread, markAsRead, findByOrderNos };
