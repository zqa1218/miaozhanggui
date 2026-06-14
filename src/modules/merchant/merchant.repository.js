const knex = require('../../shared/database/knex');

const TABLE = 'merchants';

/** 根据用户名查找 */
function findByUsername(username) {
  return knex(TABLE).where('username', username).first();
}

/** 根据 mId 查找 */
function findByMId(mId) {
  return knex(TABLE).where('m_id', mId).first();
}

/** 创建商户 */
function create(data) {
  return knex(TABLE).insert(data);
}

/** 更新商户信息 */
function updateByMId(mId, data) {
  return knex(TABLE).where('m_id', mId).update({ ...data, updated_at: knex.fn.now() });
}

/** 更新密码 */
function updatePassword(mId, passwordHash) {
  return knex(TABLE).where('m_id', mId).update({ password_hash: passwordHash, updated_at: knex.fn.now() });
}

module.exports = { findByUsername, findByMId, create, updateByMId, updatePassword };
