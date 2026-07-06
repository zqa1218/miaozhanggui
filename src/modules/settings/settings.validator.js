const Joi = require('joi');

const saveSettingsSchema = Joi.object({
  mId: Joi.string().required(),
  shopName: Joi.string().optional(),
  shopMode: Joi.string().valid('studio', 'photographer').optional(),
  qrCodeUrl: Joi.string().allow('', null).optional(),
  alipayQrUrl: Joi.string().allow('', null).optional(),
  wechatQrUrl: Joi.string().allow('', null).optional(),
  paymentQrCode: Joi.string().allow('', null).optional(),
  announcement: Joi.string().allow('', null).optional(),
  declarationEnabled: Joi.boolean().truthy(1, '1').falsy(0, '0').optional(),
  declarationContent: Joi.string().allow('', null).optional(),
});

module.exports = { saveSettingsSchema };
