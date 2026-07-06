const logger = require('../shared/logger');
const AppError = require('../shared/errors/AppError');
const config = require('../config');

function errorHandler(err, req, res, _next) {
  logger.error(`[${req.method}] ${req.originalUrl} - ${err.message}`, { stack: err.stack });

  if (err instanceof AppError) {
    return res.status(err.statusCode || 400).json({
      success: false,
      data: err.data || null,
      message: err.message,
    });
  }

  const message = config.env === 'production'
    ? '服务器开小差了'
    : err.message || '服务器内部错误';

  return res.status(500).json({
    success: false,
    data: null,
    message,
  });
}

module.exports = errorHandler;
