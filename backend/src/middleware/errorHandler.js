/**
 * 业务错误类 — 用于在 Service 层抛出可预期的错误
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'UNKNOWN') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * 全局错误处理中间件
 */
function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.expose ? err.message : (statusCode === 500 ? '服务器内部错误' : err.message);

  if (statusCode === 500) {
    console.error('[Error]', err);
  }

  res.status(statusCode).json({
    success: false,
    code: err.code || 'ERROR',
    message,
  });
}

function notFoundHandler(_req, res) {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: '接口不存在',
  });
}

module.exports = { AppError, errorHandler, notFoundHandler };
