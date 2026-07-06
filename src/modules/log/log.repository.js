const knex = require('../../shared/database/knex');

const TABLE = 'operation_logs';

function findByMerchant(mId) {
  return knex(TABLE).where('m_id', mId).orderBy('created_at', 'desc').limit(200);
}

function insert(data) {
  return knex(TABLE).insert(data);
}

function clearByMerchant(mId) {
  return knex(TABLE).where('m_id', mId).del();
}

module.exports = { findByMerchant, insert, clearByMerchant };
