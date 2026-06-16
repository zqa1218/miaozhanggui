const service = require('./auth.service');
const logger = require('../../shared/logger');

/** POST /client/auth/login — 统一 OAuth 登录 */
async function login(req, res) {
  try {
    const { provider, code, openId, nickname, avatar } = req.body;
    if (!provider || !['wechat', 'qq'].includes(provider)) {
      return res.rh.fail('provider 必须为 wechat 或 qq', 400);
    }
    if (!code && !openId) {
      return res.rh.fail('请提供授权 code 或 openId', 400);
    }
    const result = await service.oauthLogin(provider, { code, openId, nickname, avatar });
    res.rh.success(result, result.isNew ? '注册成功' : '登录成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('[ClientAuth] login error:', err);
    res.rh.error('登录失败');
  }
}

/** POST /client/auth/bind — 绑定 OAuth 到已有用户 */
async function bind(req, res) {
  try {
    const { provider, openId } = req.body;
    if (!provider || !['wechat', 'qq'].includes(provider)) {
      return res.rh.fail('provider 必须为 wechat 或 qq', 400);
    }
    const user = await service.bindOAuth(req.user.userId, provider, openId);
    res.rh.success(user, '绑定成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('[ClientAuth] bind error:', err);
    res.rh.error('绑定失败');
  }
}

/** GET /client/auth/me — 获取当前用户信息 */
async function me(req, res) {
  try {
    const user = await service.getUserById(req.user.userId);
    if (!user) return res.rh.fail('用户不存在', 404);
    res.rh.success(user);
  } catch (err) {
    logger.error('[ClientAuth] me error:', err);
    res.rh.error('获取用户信息失败');
  }
}

module.exports = { login, bind, me };
