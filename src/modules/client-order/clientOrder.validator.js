const Joi = require('joi');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// 顾客端下单：与 create-order-v2 契约一致，但 userDeviceId 可选（服务端确定性生成）+ 支持幂等键
const createOrderSchema = Joi.object({
  mId: Joi.string().required(),
  studioId: Joi.number().required(),
  styleId: Joi.number().optional().allow(null),
  fixedDuration: Joi.number().integer().min(0).optional().default(0),
  optType: Joi.string().valid('single', 'package').required(),
  photoCount: Joi.number().integer().min(1).optional(),
  modelExperience: Joi.string().valid('newcomer', 'experienced').optional().allow(null),
  roleName: Joi.string().max(256).allow('').optional(),
  contactType: Joi.string().valid('qq', 'wechat', 'phone', 'other', '').optional(),
  contactValue: Joi.string().max(128).allow('').optional(),
  contactNote: Joi.string().max(512).allow('').optional(),
  bookingStartDate: Joi.string().required(),
  bookingStartTime: Joi.string().pattern(TIME_PATTERN).required().messages({
    'string.pattern.base': '起始时间格式错误，需为 HH:mm',
  }),
  totalPrice: Joi.number().required(),
  depositAmount: Joi.number().required(),
  depositRatio: Joi.number().required(),
  selectedAddonIds: Joi.array().items(Joi.alternatives().try(Joi.number(), Joi.string())).optional().default([]),
  addonTotal: Joi.number().optional().default(0),
  extraItems: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    price: Joi.number().required(),
    unit: Joi.string().optional().default('per_time'),
    unitLabel: Joi.string().optional().allow(''),
    amount: Joi.number().optional().default(0),
  })).optional().default([]),
  characterImage: Joi.string().max(512).optional().allow(null, ''),
  referenceImages: Joi.array().items(Joi.string()).max(6).optional().allow(null),
  idempotencyKey: Joi.string().max(64).optional().allow(''),
}).options({ stripUnknown: true });

module.exports = { createOrderSchema };
