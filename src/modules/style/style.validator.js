const Joi = require('joi');

const packageItem = Joi.object({
  name: Joi.string().min(1).max(64).required().messages({ 'any.required': '套餐名称必填' }),
  photoCount: Joi.number().integer().min(1).required().messages({ 'any.required': '套餐张数必填' }),
  totalPrice: Joi.number().min(0).required().messages({ 'any.required': '套餐总价必填' }),
  fixedDuration: Joi.number().integer().min(1).required().messages({ 'any.required': '套餐耗时必填' }),
  description: Joi.string().max(256).allow('').optional(),
});

const additionalItem = Joi.object({
  name: Joi.string().min(1).max(64).required().messages({ 'any.required': '附加项目名称必填' }),
  price: Joi.number().min(0).required().messages({ 'any.required': '附加项目价格必填' }),
  unit: Joi.string().valid('per_time', 'per_session', 'per_photo', 'per_item').default('per_time'),
});

const createStyleSchema = Joi.object({
  mId: Joi.string().required(),
  styleName: Joi.string().min(1).max(128).required().messages({ 'any.required': '样式名称必填' }),
  styleCoverUrl: Joi.string().allow('').optional(),
  singlePrice: Joi.number().min(0).required().messages({ 'any.required': '单张价格必填' }),
  packages: Joi.array().items(packageItem).optional().default([]),
  additionalItems: Joi.array().items(additionalItem).optional().default([]),
  // 保留旧字段兼容
  hasPackage: Joi.boolean().default(false),
  packagePrice: Joi.number().min(0).optional().allow(null),
}).options({ stripUnknown: true });

const updateStyleSchema = Joi.object({
  id: Joi.number().required().messages({ 'any.required': '缺少样式ID' }),
  mId: Joi.string().required(),
  styleName: Joi.string().min(1).max(128).optional(),
  styleCoverUrl: Joi.string().allow('').optional(),
  singlePrice: Joi.number().min(0).optional(),
  packages: Joi.array().items(packageItem).optional(),
  additionalItems: Joi.array().items(additionalItem).optional(),
  // 保留旧字段兼容
  hasPackage: Joi.boolean().optional(),
  packagePrice: Joi.number().min(0).optional().allow(null),
}).options({ stripUnknown: true });

const deleteStyleSchema = Joi.object({
  id: Joi.number().required(),
  mId: Joi.string().required(),
});

module.exports = { createStyleSchema, updateStyleSchema, deleteStyleSchema };
