const knex = require('../../shared/database/knex');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const AppError = require('../../shared/errors/AppError');
const ERROR_CODES = require('../../shared/errors/errorCodes');
const logger = require('../../shared/logger');

const TABLE = 'users';
const JWT_EXPIRES = '30d';

// ════════════════════════════════════════
//  JWT 工具
// ════════════════════════════════════════

function generateClientToken(user) {
  return jwt.sign(
    { userId: user.id, phone: user.phone, wxOpenId: user.wx_open_id, qqOpenId: user.qq_open_id },
    config.jwt.secret,
    { expiresIn: JWT_EXPIRES },
  );
}

// ════════════════════════════════════════
//  统一 OAuth 登录
// ════════════════════════════════════════

/**
 * @param {string} provider  'wechat' | 'qq'
 * @param {object} payload 前端传入的授权信息
 *   - code?: string         微信/QQ 的临时授权码（前端 SDK 获取）
 *   - openId?: string       如果前端直接拿到了 openId 可直传
 *   - nickname?: string
 *   - avatar?: string
 */
async function oauthLogin(provider, payload) {
  const openId = await resolveOpenId(provider, payload);
  if (!openId) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '获取 OpenID 失败，请重新授权');

  const openIdField = provider === 'wechat' ? 'wx_open_id' : 'qq_open_id';

  // 已有此 OAuth 用户 → 直接登录
  let user = await knex(TABLE).where(openIdField, openId).first();
  if (user) {
    // 更新昵称头像
    const updates = {};
    if (payload.nickname) updates.nickname = payload.nickname;
    if (payload.avatar) updates.avatar = payload.avatar;
    if (Object.keys(updates).length) {
      await knex(TABLE).where('id', user.id).update(updates);
      user = { ...user, ...updates };
    }
    const token = generateClientToken(user);
    return { token, user: sanitizeUser(user), isNew: false };
  }

  // 新用户 → 自动注册
  const [id] = await knex(TABLE).insert({
    [openIdField]: openId,
    nickname: payload.nickname || null,
    avatar: payload.avatar || null,
  });
  user = await knex(TABLE).where('id', id).first();
  const token = generateClientToken(user);
  logger.info(`[OAuth] 新用户注册 ${provider} openId=${openId.slice(0, 10)}... userId=${id}`);
  return { token, user: sanitizeUser(user), isNew: true };
}

// ════════════════════════════════════════
//  绑定已有用户到 OAuth
// ════════════════════════════════════════

async function bindOAuth(userId, provider, openId) {
  if (!openId) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '缺少 OpenID');

  const openIdField = provider === 'wechat' ? 'wx_open_id' : 'qq_open_id';

  // 检查此 OpenID 是否已被其他用户绑定
  const existing = await knex(TABLE).where(openIdField, openId).whereNot('id', userId).first();
  if (existing) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '该账号已被其他用户绑定');

  await knex(TABLE).where('id', userId).update({
    [openIdField]: openId,
    updated_at: knex.fn.now(),
  });

  const user = await knex(TABLE).where('id', userId).first();
  return sanitizeUser(user);
}

// ════════════════════════════════════════
//  通过 userId 查询用户
// ════════════════════════════════════════

async function getUserById(userId) {
  const user = await knex(TABLE).where('id', userId).first();
  return user ? sanitizeUser(user) : null;
}

// ════════════════════════════════════════
//  工具函数
// ════════════════════════════════════════

/** 根据 provider 解析 OpenID */
async function resolveOpenId(provider, payload) {
  // 如果前端已经拿到 openId（微信 H5 静默授权 etc.），直接使用
  if (payload.openId) return payload.openId;

  // 如果有 code，通过平台 API 换取 openId
  if (payload.code) {
    return exchangeCodeForOpenId(provider, payload.code);
  }

  return null;
}

/**
 * 用 code 向微信/QQ 换取 openId
 * 实际生产环境需配置 appId/secret 并调用平台 API
 */
async function exchangeCodeForOpenId(provider, code) {
  try {
    if (provider === 'wechat') {
      const appId = config.wechat.appId;
      const secret = config.wechat.secret;
      if (!appId || !secret) {
        logger.warn('[OAuth] 微信 appId/secret 未配置，使用 code 作为临时标识');
        return 'wx_dev_' + code.slice(0, 32);
      }
      // TODO: 对接微信 openapi
      // const resp = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${secret}&code=${code}&grant_type=authorization_code`);
      // const data = await resp.json();
      // return data.openid;
      logger.warn('[OAuth] 微信 API 对接待实现，使用 code hash');
      return 'wx_' + code.slice(0, 32);
    }

    if (provider === 'qq') {
      // TODO: 对接 QQ 互联 OAuth2
      logger.warn('[OAuth] QQ API 对接待实现，使用 code hash');
      return 'qq_' + code.slice(0, 32);
    }

    return null;
  } catch (err) {
    logger.error('[OAuth] 换取 OpenID 失败:', err.message);
    return null;
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    avatar: user.avatar,
    wxBound: !!user.wx_open_id,
    qqBound: !!user.qq_open_id,
    createdAt: user.created_at,
  };
}

module.exports = { oauthLogin, bindOAuth, getUserById };
