/**
 *   自定义业务错误：携带错误码 + HTTP状态码
 */
class AppError extends Error {
  /**
   * @param {object} errDef     - 来自 errorCodes.js 的错误定义
   * @param {number} statusCode - HTTP 状态码
   * @param {string} customMsg  - 可选覆盖 message
   */
  constructor(errDef, statusCode = 400, customMsg = null) {
    super(customMsg || errDef.message);
    this.code = errDef.code;
    this.statusCode = statusCode;
    this.isOperational = true; // 标记为可预期的业务错误
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
