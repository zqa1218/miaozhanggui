const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 客户端 JWT 鉴权中间件
 * 用于用户的微信/QQ 登录后的请求鉴权
 */
function clientAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.rh.fail('请先登录', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded; // { userId, phone, wxOpenId, qqOpenId }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.rh.fail('登录已过期，请重新授权', 401);
    }
    return res.rh.fail('无效的登录凭证', 401);
  }
}

module.exports = clientAuthMiddleware;
