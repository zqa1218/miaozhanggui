const { validationResult } = require('express-validator');

/**
 * express-validator 校验结果拦截中间件
 * 用法: router.post('/path', [...rules, validate], controller.action)
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: '参数校验失败',
      errors: errors.array({ onlyFirstError: true }),
    });
  }
  next();
}

module.exports = { validate };
