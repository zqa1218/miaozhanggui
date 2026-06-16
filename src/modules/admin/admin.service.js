const knex = require('../../shared/database/knex');
const crypto = require('crypto');
const AppError = require('../../shared/errors/AppError');
const ERROR_CODES = require('../../shared/errors/errorCodes');

/**
 * 生成随机邀请码 (8位大写字母+数字)
 */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符 0/O/1/I
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * 批量生成邀请码
 */
async function generateCodes(count = 1) {
  if (count < 1 || count > 1000) {
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '数量需在 1-1000 之间');
  }

  const codes = [];
  const batch = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    batch.push({ code, is_used: false });
    codes.push(code);
  }

  // 批量插入 (INSERT IGNORE 处理碰撞)
  await knex('invitation_codes').insert(batch).onConflict('code').ignore();

  return { count, codes: codes.slice(0, 100) };
}

/**
 * 查询所有邀请码（支持分页 + 过滤）
 */
async function listCodes(filters = {}) {
  const { page = 1, pageSize = 20, isUsed } = filters;
  let q = knex('invitation_codes').orderBy('created_at', 'desc');

  if (isUsed !== undefined) {
    q = q.where('is_used', isUsed === 'true' || isUsed === true ? 1 : 0);
  }

  const [totalRow, rows] = await Promise.all([
    q.clone().count('* as total').first(),
    q.limit(parseInt(pageSize)).offset((parseInt(page) - 1) * parseInt(pageSize)),
  ]);

  return {
    total: parseInt(totalRow.total) || 0,
    list: rows,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
  };
}

/**
 * 原子化核销邀请码（在事务中执行 SELECT ... FOR UPDATE）
 */
async function claimCode(trx, code, mId) {
  // SELECT ... FOR UPDATE 锁住该行，防止并发双花
  const rows = await knex('invitation_codes')
    .transacting(trx)
    .where({ code, is_used: false })
    .forUpdate()
    .select('id', 'code', 'is_used');

  if (rows.length === 0) {
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '邀请码无效或已被使用');
  }

  // 标记已使用
  await knex('invitation_codes')
    .transacting(trx)
    .where('id', rows[0].id)
    .update({ is_used: true, used_by_m_id: mId, used_at: knex.fn.now() });

  return true;
}

/**
 * 查询商家列表（管理员）
 */
async function listMerchants(filters = {}) {
  const { page = 1, pageSize = 20, keyword } = filters;
  let q = knex('merchants as m')
    .leftJoin('invitation_codes as ic', 'm.m_id', 'ic.used_by_m_id')
    .orderBy('m.created_at', 'desc');

  if (keyword) {
    q = q.where(function () {
      this.where('m.username', 'like', `%${keyword}%`)
        .orWhere('m.shop_name', 'like', `%${keyword}%`)
        .orWhere('m.m_id', 'like', `%${keyword}%`);
    });
  }

  const [totalRow, rows] = await Promise.all([
    q.clone().count('m.id as total').first(),
    q.clone().limit(parseInt(pageSize)).offset((parseInt(page) - 1) * parseInt(pageSize))
      .select('m.id', 'm.m_id', 'm.username', 'm.shop_name', 'm.shop_mode', 'm.is_studio_owner', 'm.is_admin', 'm.created_at', 'm.updated_at', 'ic.code as invitation_code'),
  ]);

  return {
    total: parseInt(totalRow.total) || 0,
    list: rows,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
  };
}

module.exports = { generateCodes, listCodes, claimCode, listMerchants };
