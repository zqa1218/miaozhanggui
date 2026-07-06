const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 可选的客户端 JWT 鉴权中间件
 * 有 Token 则解析，无 Token 则跳过（不拦截）
 */
function optionalClientAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      req.user = jwt.verify(token, config.jwt.secret);
    } catch (_) { /* Token 无效也放行，走 deviceId 兼容 */ }
  }
  next();
}

module.exports = optionalClientAuth;
