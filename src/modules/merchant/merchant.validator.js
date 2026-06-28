const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(32).required().messages({
    'string.min': '  账号至少3个字符  ',
    'any.required': '  请输入账号  ',
  }),
  password: Joi.string().min(6).max(64).required().messages({
    'string.min': '  密码至少6个字符  ',
    'any.required': '  请输入密码  ',
  }),
  shopName: Joi.string().min(1).max(128).required().messages({
    'any.required': '  请输入店铺名称  ',
  }),
  isStudioOwner: Joi.boolean().default(false),
  merchantRole: Joi.string().valid('photographer', 'makeup_artist', 'studio_owner').default('photographer').messages({
    'any.only': '  身份类型无效，可选：摄影 / 妆娘 / 棚主  ',
  }),
  invitationCode: Joi.string().min(8).max(16).required().messages({
    'any.required': '  请输入邀请码  ',
    'string.min': '  邀请码格式不正确  ',
  }),
});

const loginSchema = Joi.object({
  username: Joi.string().required().messages({ 'any.required': '  请输入账号  ' }),
  password: Joi.string().required().messages({ 'any.required': '  请输入密码  ' }),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).max(64).required(),
});

module.exports = { registerSchema, loginSchema, changePasswordSchema };
