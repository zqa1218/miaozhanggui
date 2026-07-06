const Joi = require('joi');

const applyCancelSchema = Joi.object({
  orderNo: Joi.string().required(),
  mId: Joi.string().required(),
  refundText: Joi.string().allow('').optional(),
  refundImgUrl: Joi.string().allow('').optional(),
});

module.exports = { applyCancelSchema };
