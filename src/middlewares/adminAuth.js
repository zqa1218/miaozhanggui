const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 超级管理员鉴权中间件
 * 仅限 isAdmin=true 的 Token 访问
 */
function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.rh.fail('请先登录', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (!decoded.isAdmin) {
      return res.rh.fail('无管理员权限', 403);
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.rh.fail('登录已过期', 401);
    }
    return res.rh.fail('无效的登录凭证', 401);
  }
}

module.exports = adminAuthMiddleware;
