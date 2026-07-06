const knex = require('../../shared/database/knex');

const TABLE = 'reschedule_requests';

function create(data) {
  return knex(TABLE).insert(data);
}

function findById(id) {
  return knex(TABLE).where('id', id).first();
}

function findByMerchant(mId, status) {
  let q = knex(TABLE).where('m_id', mId).orderBy('created_at', 'desc');
  if (status) q = q.where('status', status);
  return q;
}

function updateStatus(id, mId, status) {
  return knex(TABLE).where({ id, m_id: mId }).update({ status, updated_at: knex.fn.now() });
}

function findByOrderNo(orderNo, mId) {
  return knex(TABLE).where({ order_no: orderNo, m_id: mId }).orderBy('created_at', 'desc');
}

module.exports = { create, findById, findByMerchant, updateStatus, findByOrderNo };
