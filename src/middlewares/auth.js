const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT 鉴权中间件 —— 管理端必需
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.rh.fail('请先登录', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.rh.fail('登录已过期', 401);
    }
    return res.rh.fail('无效的Token', 401);
  }
}

module.exports = authMiddleware;
