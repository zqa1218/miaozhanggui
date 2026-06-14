const logger = require('../shared/logger');
const AppError = require('../shared/errors/AppError');

/**
 * 全局错误处理中间件（必须4个参数）
 * 统一返回格式: { success: false, data: null, message: string }
 */
function errorHandler(err, req, res, _next) {
  logger.error(`[${req.method}] ${req.originalUrl} - ${err.message}`, { stack: err.stack });

  if (err instanceof AppError) {
    return res.status(err.statusCode || 400).json({
      success: false,
      data: err.data || null,
      message: err.message,
    });
  }

  return res.status(500).json({
    success: false,
    data: null,
    message: '服务器开小差了',
  });
}

module.exports = errorHandler;
