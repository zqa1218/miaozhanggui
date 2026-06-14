/**
 * 统一响应格式 —— Express res 扩展
 * 返回格式: { success: boolean, data: any, message: string }
 */
class ResponseHelper {
  constructor(res) {
    this.res = res;
  }

  /** 成功响应 (HTTP 200) */
  success(data = null, message = 'ok') {
    return this.res.status(200).json({ success: true, data, message });
  }

  /** 业务错误 (HTTP 400/401/403/404...) */
  fail(message = '请求失败', httpCode = 400, data = null) {
    return this.res.status(httpCode).json({ success: false, data, message });
  }

  /** 服务器内部错误 (HTTP 500) */
  error(message = '服务器内部错误') {
    return this.res.status(500).json({ success: false, data: null, message });
  }
}

/**
 * Express 中间件：将 response helper 挂载到 res.rh
 */
function responseMiddleware(req, res, next) {
  res.rh = new ResponseHelper(res);
  next();
}

module.exports = { ResponseHelper, responseMiddleware };
