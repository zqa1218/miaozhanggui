const Joi = require('joi');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const extraItemSchema = Joi.object({
  name: Joi.string().min(1).max(64).required().messages({ 'any.required': '附加项目名称必填' }),
  price: Joi.number().min(0).default(0),
  unit: Joi.string().valid('per_time', 'per_photo', 'per_item').default('per_time'),
  negotiable: Joi.boolean().default(false),
  priceRangeMin: Joi.number().min(0).default(0),
  priceRangeMax: Joi.number().min(0).default(0),
});

const createStudioSchema = Joi.object({
  mId: Joi.string().required(),
  title: Joi.string().min(1).max(256).required().messages({ 'any.required': '项目名称必填' }),
  city: Joi.string().max(128).allow('').optional(),
  description: Joi.string().allow('').optional(),
  coverUrl: Joi.string().allow('').optional(),
  detailImgUrls: Joi.array().items(Joi.string()).optional(),

  // 全时段模式
  isAllTimeOpen: Joi.boolean().default(false),

  // Step 1: 可选日期（全时段模式下允许空数组）
  availableDates: Joi.when('isAllTimeOpen', {
    is: true,
    then: Joi.array().items(Joi.string()).optional().default([]),
    otherwise: Joi.array().items(Joi.string()).min(1).required().messages({
      'array.min': '至少选择1个可选日期',
      'any.required': '可选日期必填',
    }),
  }),

  // Step 2: 时间轴配置
  baseStartTime: Joi.string().pattern(TIME_PATTERN).required().messages({
    'string.pattern.base': '工作起始时间格式错误，需为 HH:mm',
    'any.required': '工作起始时间必填',
  }),
  baseEndTime: Joi.string().pattern(TIME_PATTERN).required().messages({
    'string.pattern.base': '工作结束时间格式错误，需为 HH:mm',
    'any.required': '工作结束时间必填',
  }),
  intervalRestTime: Joi.number().integer().min(0).default(0),
  restSlots: Joi.array().items(Joi.object({
    start_time: Joi.string().pattern(TIME_PATTERN).allow('').optional(),
    end_time: Joi.string().pattern(TIME_PATTERN).allow('').optional(),
    day_of_week: Joi.number().integer().min(0).max(6).allow(null).optional(),
    reason: Joi.string().max(128).allow('').optional(),
  })).optional().default([]),
  isReplicated: Joi.boolean().default(true),

  // Step 3: 计价模式
  isStyleEnabled: Joi.boolean().default(false),
  selectedStyleIds: Joi.when('isStyleEnabled', {
    is: true,
    then: Joi.array().items(Joi.number()).min(1).required().messages({
      'array.min': '启用样式时至少选择一个样式',
      'any.required': '启用样式时需选择样式',
    }),
    otherwise: Joi.array().items(Joi.number()).optional(),
  }),
  // 原生计价 (isStyleEnabled=false 时)
  hasPackage: Joi.boolean().default(false),
  pricingModel: Joi.string().valid('single', 'package', 'both').default('single'),
  singlePrice: Joi.when('isStyleEnabled', {
    is: false,
    then: Joi.when('pricingModel', {
      is: 'package',
      then: Joi.number().min(0).optional().allow(null),
      otherwise: Joi.number().min(0).required().messages({ 'any.required': '单张价格必填' }),
    }),
    otherwise: Joi.number().min(0).optional(),
  }),
  packagePrice: Joi.when('isStyleEnabled', {
    is: false,
    then: Joi.when('pricingModel', {
      is: Joi.string().valid('package', 'both'),
      then: Joi.number().min(0).required().messages({ 'any.required': '套餐价格必填' }),
      otherwise: Joi.number().min(0).optional().allow(null),
    }),
    otherwise: Joi.number().min(0).optional().allow(null),
  }),

  // 通用服务时间配置
  singleShotTime: Joi.number().integer().min(1).required().messages({ 'any.required': '单张拍摄时间必填' }),
  packageTime: Joi.number().integer().min(1).optional().allow(null, 0),
  packageSessionCount: Joi.number().integer().min(1).default(1),
  isExperienceEnabled: Joi.boolean().default(false),
  noviceSingleAddTime: Joi.number().integer().min(0).default(0),
  novicePackageAddTime: Joi.number().integer().min(0).default(0),
  depositRatio: Joi.number().valid(0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50).default(30),
  addressRequired: Joi.boolean().default(false),
  extraItems: Joi.array().items(extraItemSchema).optional().default([]),
}).options({ stripUnknown: true });

const updateStudioSchema = Joi.object({
  id: Joi.number().required().messages({ 'any.required': '缺少项目ID' }),
  mId: Joi.string().required(),
  title: Joi.string().min(1).max(256).optional(),
  city: Joi.string().max(128).allow('').optional(),
  description: Joi.string().allow('').optional(),
  coverUrl: Joi.string().allow('').optional(),
  detailImgUrls: Joi.array().items(Joi.string()).optional(),
  isAllTimeOpen: Joi.boolean().optional(),
  availableDates: Joi.array().items(Joi.string()).min(0).optional(),
  baseStartTime: Joi.string().pattern(TIME_PATTERN).optional(),
  baseEndTime: Joi.string().pattern(TIME_PATTERN).optional(),
  intervalRestTime: Joi.number().integer().min(0).optional(),
  restSlots: Joi.array().items(Joi.object({
    start_time: Joi.string().pattern(TIME_PATTERN).allow('').optional(),
    end_time: Joi.string().pattern(TIME_PATTERN).allow('').optional(),
    day_of_week: Joi.number().integer().min(0).max(6).allow(null).optional(),
    reason: Joi.string().max(128).allow('').optional(),
  })).optional().default([]),
  isReplicated: Joi.boolean().optional(),
  isStyleEnabled: Joi.boolean().optional(),
  selectedStyleIds: Joi.array().items(Joi.number()).optional(),
  pricingModel: Joi.string().valid('single', 'package', 'both').optional(),
  singlePrice: Joi.number().min(0).optional().allow(null),
  hasPackage: Joi.boolean().optional(),
  packagePrice: Joi.number().min(0).optional().allow(null),
  // 通用服务时间配置 — 更新时全字段可选
  singleShotTime: Joi.number().integer().min(1).optional(),
  packageTime: Joi.number().integer().min(1).optional().allow(null, 0),
  packageSessionCount: Joi.number().integer().min(1).optional(),
  isExperienceEnabled: Joi.boolean().optional(),
  noviceSingleAddTime: Joi.number().integer().min(0).optional(),
  novicePackageAddTime: Joi.number().integer().min(0).optional(),
  depositRatio: Joi.number().valid(0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50).optional(),
  addressRequired: Joi.boolean().optional(),
  extraItems: Joi.array().items(extraItemSchema).optional(),
}).options({ stripUnknown: true });

const deleteStudioSchema = Joi.object({
  id: Joi.number().required().messages({ 'any.required': '缺少项目ID' }),
  mId: Joi.string().optional(),
});

module.exports = { createStudioSchema, updateStudioSchema, deleteStudioSchema };
