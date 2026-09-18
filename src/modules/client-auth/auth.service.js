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
    mpBound: !!user.wx_mp_open_id,
    createdAt: user.created_at,
  };
}

// ════════════════════════════════════════
//  微信小程序登录（快速注册 = 首次登录自动建号）
// ════════════════════════════════════════

/**
 * 用小程序 wx.login() 的 code 换取 openid（真实 jscode2session）
 * 未配置 WECHAT_MP_APPID/SECRET 时降级为开发桩（与既有网页 OAuth 同策略）
 */
async function code2Session(code) {
  const appId = config.wechat.mpAppId;
  const secret = config.wechat.mpSecret;
  if (!appId || !secret) {
    logger.warn('[mpLogin] 未配置 WECHAT_MP_APPID/SECRET，使用 code 作为临时标识（开发桩）');
    return { openid: 'mp_dev_' + code.slice(0, 32), session_key: null, unionid: null };
  }
  const url = `https://api.weixin.qq.com/sns/jscode2session`
    + `?appid=${encodeURIComponent(appId)}`
    + `&secret=${encodeURIComponent(secret)}`
    + `&js_code=${encodeURIComponent(code)}`
    + `&grant_type=authorization_code`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data || data.errcode) {
    logger.error('[mpLogin] jscode2session 失败:', data && (data.errmsg || data.errcode));
    throw new AppError(ERROR_CODES.LOGIN_FAILED, 401, '微信登录失败，请重试');
  }
  return { openid: data.openid, session_key: data.session_key || null, unionid: data.unionid || null };
}

/**
 * 小程序登录：查渠道表 → 按 unionid 关联 → 自动注册 → 双写
 * @param {string} code    wx.login() 返回的 code
 * @param {object} profile { nickname?, avatar? }
 */
async function mpLogin(code, profile = {}) {
  if (!code) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '缺少登录 code');

  const { openid, session_key, unionid } = await code2Session(code);
  const nickname = profile.nickname || null;
  const avatar = profile.avatar || null;

  // 1) 先查渠道归一表
  let oauth = await knex('user_oauth_accounts')
    .where({ provider: 'wechat_miniapp', open_id: openid }).first();
  let user = null;
  let isNew = false;

  if (oauth) {
    user = await knex('users').where('id', oauth.user_id).first();
  }

  // 2) 未找到用户 → 按 unionid 关联已有 users 行
  if (!user && unionid) {
    user = await knex('users').where('union_id', unionid).first();
  }

  if (user) {
    // 已存在 → 更新昵称/头像/session/登录时间，补双写
    const updates = { last_login_at: knex.fn.now() };
    if (nickname) updates.nickname = nickname;
    if (avatar) updates.avatar = avatar;
    if (session_key) updates.wx_mp_session_key = session_key;
    if (!user.wx_mp_open_id) updates.wx_mp_open_id = openid;
    if (unionid && !user.union_id) updates.union_id = unionid;
    if (Object.keys(updates).length) {
      await knex('users').where('id', user.id).update(updates);
      user = { ...user, ...updates };
    }
  } else {
    // 新用户 → 自动注册
    const [id] = await knex('users').insert({
      nickname,
      avatar,
      union_id: unionid || null,
      wx_mp_open_id: openid,
      wx_mp_session_key: session_key || null,
      last_login_at: knex.fn.now(),
    });
    user = await knex('users').where('id', id).first();
    isNew = true;
    logger.info(`[mpLogin] 新小程序用户注册 openid=${openid.slice(0, 10)}... userId=${id}`);
  }

  // 3) 双写渠道归一表（幂等）
  if (oauth) {
    await knex('user_oauth_accounts').where('id', oauth.id).update({
      user_id: user.id,
      union_id: unionid || null,
      meta: session_key ? JSON.stringify({ session_key }) : null,
      updated_at: knex.fn.now(),
    });
  } else {
    await knex('user_oauth_accounts').insert({
      user_id: user.id,
      provider: 'wechat_miniapp',
      open_id: openid,
      union_id: unionid || null,
      meta: session_key ? JSON.stringify({ session_key }) : null,
    }).onConflict(['provider', 'open_id']).ignore();
  }

  const token = generateClientToken(user);
  return { token, user: sanitizeUser(user), isNew };
}

/**
 * 小程序手机号绑定（getPhoneNumber 的 code → wxa/business/getuserphonenumber）
 * 需小程序商户认证；未认证则引导用户个人中心手动补（可选功能）
 */
async function mpPhone(userId, code) {
  if (!code) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '缺少手机号 code');
  const appId = config.wechat.mpAppId;
  const secret = config.wechat.mpSecret;
  if (!appId || !secret) {
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '未配置小程序密钥，请手动填写手机号');
  }

  const tokenResp = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential`
    + `&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`
  );
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    throw new AppError(ERROR_CODES.LOGIN_FAILED, 401, '获取 access_token 失败: ' + (tokenData.errmsg || ''));
  }

  const resp = await fetch(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${tokenData.access_token}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) },
  );
  const data = await resp.json();
  if (!data || data.errcode !== 0 || !data.phone_info) {
    throw new AppError(ERROR_CODES.LOGIN_FAILED, 400, '获取手机号失败: ' + (data && data.errmsg || data && data.errcode));
  }

  const phone = data.phone_info.purePhoneNumber;
  await knex('users').where('id', userId).update({ phone, updated_at: knex.fn.now() });
  return { phone };
}

module.exports = { oauthLogin, bindOAuth, getUserById, mpLogin, mpPhone };
