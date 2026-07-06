const Joi = require('joi');

/**
 * 参数校验中间件工厂
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      const msg = error.details.map((d) => d.message).join('; ');
      return res.rh.fail(msg, 400);
    }
    req[source] = value;
    next();
  };
}

module.exports = validate;
