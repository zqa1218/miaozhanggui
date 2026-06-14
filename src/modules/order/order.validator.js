const Joi = require('joi');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// 旧版 schema (保持兼容)
const createOrderSchema = Joi.object({
  mId: Joi.string().required(),
  studioId: Joi.number().required(),
  studioTitle: Joi.string().required(),
  serviceMode: Joi.string().valid('studio', 'photographer').required(),
  date: Joi.string().required(),
  times: Joi.array().items(Joi.string()).required().min(1),
  timesEnd: Joi.array().items(Joi.string()).optional(),
  isPackageOrder: Joi.boolean().default(false),
  totalPrice: Joi.number().required(),
  depositAmount: Joi.number().required(),
  depositRatio: Joi.number().required(),
  contact: Joi.string().required(),
  peopleCount: Joi.number().default(1),
  photoCount: Joi.number().optional(),
  userDeviceId: Joi.string().required(),
  calcMode: Joi.string().optional(),
  isHolidayPrice: Joi.boolean().optional(),
});

// V2 高精度闭合时间下单
const createOrderV2Schema = Joi.object({
  mId: Joi.string().required(),
  studioId: Joi.number().required(),
  styleId: Joi.number().optional().allow(null),
  packageId: Joi.number().optional().allow(null),
  fixedDuration: Joi.number().integer().min(0).optional().default(0),
  optType: Joi.string().valid('single', 'package').required(),
  photoCount: Joi.when('optType', {
    is: 'single',
    then: Joi.number().integer().min(1).required().messages({ 'any.required': '拍摄张数必填' }),
    otherwise: Joi.number().optional(),
  }),
  modelExperience: Joi.string().valid('newcomer', 'experienced').optional().allow(null),
  roleName: Joi.string().max(256).allow('').optional(),
  contactType: Joi.string().valid('qq', 'wechat', 'phone', 'other', '').optional(),
  contactValue: Joi.string().max(128).allow('').optional(),
  contactNote: Joi.string().max(512).allow('').optional(),
  bookingStartDate: Joi.string().required().messages({ 'any.required': '预约日期必填' }),
  bookingStartTime: Joi.string().pattern(TIME_PATTERN).required().messages({
    'string.pattern.base': '起始时间格式错误，需为 HH:mm',
    'any.required': '起始时间必填',
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
  userDeviceId: Joi.string().required(),
}).options({ stripUnknown: true });

const payDepositSchema = Joi.object({
  orderNo: Joi.string().required(),
  mId: Joi.string().required(),
});

const confirmLockSchema = Joi.object({
  orderNo: Joi.string().required(),
  mId: Joi.string().required(),
});

const updateStatusSchema = Joi.object({
  orderNo: Joi.string().required(),
  status: Joi.string().valid(
    '待支付', '已付定金', '已确认锁定',
    '尾款待确认', '已结清', '已完成拍摄',
    '已取消', '退款审核中', '已退款取消',
    // 英文枚举值 (兼容外部调用)
    'pending', 'pre_paid', 'confirmed',
    'final_pending', 'paid', 'completed',
    'cancelled', 'refunding', 'refunded'
  ).required(),
  mId: Joi.string().optional(),
  archiveType: Joi.string().optional(),
});

const archiveOrderSchema = Joi.object({
  orderNo: Joi.string().required(),
  type: Joi.string().valid(
    '已完成拍摄', '已取消', '已退款取消',
    'completed', 'cancelled', 'refunded'
  ).required(),
  mId: Joi.string().optional(),
});

// ═══ 状态机验证 ═══

const statusTransitionSchema = Joi.object({
  orderNo: Joi.string().required().messages({ 'any.required': '缺少订单号' }),
  mId: Joi.string().optional(),
});

const requestRescheduleSchema = Joi.object({
  orderNo: Joi.string().required().messages({ 'any.required': '缺少订单号' }),
  requestedNewTime: Joi.string().max(64).optional().allow(''),
  userDeviceId: Joi.string().optional(),
});

const requestCancelSchema = Joi.object({
  orderNo: Joi.string().required().messages({ 'any.required': '缺少订单号' }),
  userDeviceId: Joi.string().optional(),
});

module.exports = {
  createOrderSchema, createOrderV2Schema,
  payDepositSchema, confirmLockSchema,
  updateStatusSchema, archiveOrderSchema,
  statusTransitionSchema, requestRescheduleSchema, requestCancelSchema,
};
