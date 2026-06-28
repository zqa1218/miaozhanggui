const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knex = require('../../shared/database/knex');
const config = require('../../config');
const ERROR_CODES = require('../../shared/errors/errorCodes');
const AppError = require('../../shared/errors/AppError');
const repo = require('./merchant.repository');
const invitationService = require('../admin/admin.service');

/**  注册（须邀请码） */
async function register({ username, password, shopName, isStudioOwner, merchantRole, invitationCode }) {
  if (!invitationCode) {
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '  缺少邀请码，请联系管理员获取  ');
  }

  const exists = await repo.findByUsername(username);
  if (exists) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '  该账号已被注册  ');

  const mId = `shop_${Date.now()}`;
  const passwordHash = await bcrypt.hash(password, 10);

  // ★ 原子化：事务中核销邀请码 + 创建商家
  await knex.transaction(async (trx) => {
    await invitationService.claimCode(trx, invitationCode, mId);

    await repo.create({
      m_id: mId,
      username,
      password_hash: passwordHash,
      shop_name: shopName,
      is_studio_owner: isStudioOwner || false,
      merchant_role: merchantRole || 'photographer',
    }, trx);
  });

  const token = generateToken(mId, username);
  return {
    mId,
    username,
    shopName,
    isStudioOwner: isStudioOwner || false,
    merchantRole: merchantRole || 'photographer',
    token,
    message: '  注册成功！这是你的商家ID: ' + mId + '，请妥善保存  ',
  };
}

/**  登录 */
async function login({ username, password }) {
  const merchant = await repo.findByUsername(username);
  if (!merchant) throw new AppError(ERROR_CODES.LOGIN_FAILED, 401, '  账号或密码错误  ');

  const valid = await bcrypt.compare(password, merchant.password_hash);
  if (!valid) throw new AppError(ERROR_CODES.LOGIN_FAILED, 401, '  账号或密码错误  ');

  const token = generateToken(merchant.m_id, merchant.username, merchant.is_admin);
  return {
    mId: merchant.m_id,
    username: merchant.username,
    shopName: merchant.shop_name,
    shopMode: merchant.shop_mode,
    isStudioOwner: !!merchant.is_studio_owner,
    merchantRole: merchant.merchant_role || 'photographer',
    isAdmin: !!merchant.is_admin,
    token,
  };
}

/**  修改密码 */
async function changePassword(mId, { oldPassword, newPassword }) {
  const merchant = await repo.findByMId(mId);
  if (!merchant) throw new AppError(ERROR_CODES.MERCHANT_NOT_FOUND, 404);

  const valid = await bcrypt.compare(oldPassword, merchant.password_hash);
  if (!valid) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '  原密码错误  ');

  const hash = await bcrypt.hash(newPassword, 10);
  await repo.updatePassword(mId, hash);
}

/**  获取商家信息 */
async function getProfile(mId) {
  const merchant = await repo.findByMId(mId);
  if (!merchant) throw new AppError(ERROR_CODES.MERCHANT_NOT_FOUND, 404);

  return {
    mId: merchant.m_id,
    username: merchant.username,
    shopName: merchant.shop_name,
    shopMode: merchant.shop_mode,
    isStudioOwner: !!merchant.is_studio_owner,
    merchantRole: merchant.merchant_role || 'photographer',
    qrCodeUrl: merchant.qr_code_url,
    announcement: merchant.announcement,
    createdAt: merchant.created_at,
  };
}

/**  更新商家信息 */
async function updateProfile(mId, data) {
  const updates = {};
  if (data.shopName !== undefined) updates.shop_name = data.shopName;
  if (data.shopMode !== undefined) updates.shop_mode = data.shopMode;
  if (data.isStudioOwner !== undefined) updates.is_studio_owner = data.isStudioOwner;
  if (data.merchantRole !== undefined) updates.merchant_role = data.merchantRole;
  if (data.qrCodeUrl !== undefined) updates.qr_code_url = data.qrCodeUrl;
  if (data.announcement !== undefined) updates.announcement = data.announcement;
  await repo.updateByMId(mId, updates);
  return getProfile(mId);
}

/**  生成 JWT */
function generateToken(mId, username, isAdmin) {
  return jwt.sign({ mId, username, isAdmin: !!isAdmin }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

/** 获取所有有活跃项目的商家（公开接口） */
async function listPublicMerchants() {
  const rows = await knex('studios')
    .join('merchants', 'studios.m_id', 'merchants.m_id')
    .where('studios.is_deleted', false)
    .distinct('merchants.m_id', 'merchants.shop_name')
    .orderBy('merchants.created_at', 'desc');
  return rows;
}

module.exports = { register, login, changePassword, getProfile, updateProfile, listPublicMerchants };
