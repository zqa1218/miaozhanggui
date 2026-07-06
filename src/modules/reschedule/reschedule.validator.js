const Joi = require('joi');

const applySchema = Joi.object({
  mId: Joi.string().required(),
  orderNo: Joi.string().required(),
  oldDate: Joi.string().required(),
  oldTimes: Joi.array().items(Joi.string()).required(),
  oldTimesEnd: Joi.array().items(Joi.string()).optional(),
  newDate: Joi.string().required(),
  newTimes: Joi.array().items(Joi.string()).required(),
  newTimesEnd: Joi.array().items(Joi.string()).optional(),
  reason: Joi.string().allow('').optional(),
});

const approveRejectSchema = Joi.object({
  mId: Joi.string().required(),
  requestId: Joi.number().required(),
});

module.exports = { applySchema, approveRejectSchema };
