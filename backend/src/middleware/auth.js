const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'mzg_booking_jwt_2026';

function authRequired(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError('请先登录', 401, 'UNAUTHORIZED'));
  try {
    req.merchant = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new AppError('登录已过期，请重新登录', 401, 'TOKEN_EXPIRED'));
  }
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { authRequired, signToken, JWT_SECRET };
