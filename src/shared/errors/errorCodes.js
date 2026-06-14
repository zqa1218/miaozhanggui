/**
 *   错误码定义 —— 每个错误码对应前端可根据 code 做不同处理
 *   0:  成功
 *   1xxx:  参数类
 *   2xxx:  认证类
 *   3xxx:  业务类
 *   5xxx:  服务器类
 */
const ERROR_CODES = {
  SUCCESS:              { code: 0,     message: ' ' },

  PARAM_INVALID:        { code: 1001,  message: '  参数不完整  ' },
  PARAM_DATE_INVALID:   { code: 1002,  message: '  日期不合法  ' },
  PARAM_TIME_INVALID:   { code: 1003,  message: '  时段选择有误  ' },

  UNAUTHORIZED:         { code: 2001,  message: '  请先登录  ' },
  TOKEN_EXPIRED:        { code: 2002,  message: '  登录已过期  ' },
  LOGIN_FAILED:         { code: 2003,  message: '  账号或密码错误  ' },
  MERCHANT_NOT_FOUND:   { code: 2004,  message: '  商家不存在  ' },

  SLOT_CONFLICT:        { code: 3001,  message: '  该时段已被预定  ' },
  STUDIO_NOT_FOUND:     { code: 3002,  message: '  项目不存在  ' },
  ORDER_NOT_FOUND:      { code: 3003,  message: '  订单不存在  ' },
  STATUS_NOT_ALLOWED:   { code: 3004,  message: '  当前状态不允许此操作  ' },
  FULL_DAY_BLOCKED:     { code: 3005,  message: '  该日期已包场锁定  ' },
  UNAVAILABLE_SLOT:     { code: 3006,  message: '  该时段商家不接单  ' },
  PHOTO_LIMIT_EXCEEDED: { code: 3007,  message: '  该时段接单数已达上限  ' },
  RESCHEDULE_NOT_FOUND: { code: 3008,  message: '  改期申请不存在  ' },
  REFUND_STATUS_INVALID:{ code: 3009,  message: '  当前状态不允许退款  ' },
  TIME_CONFIG_INVALID:  { code: 3010,  message: '  营业时间配置不合法  ' },
  STYLE_NOT_FOUND:      { code: 3011,  message: '  样式不存在  ' },
  STYLE_IN_USE:         { code: 3012,  message: '  样式已被项目引用，无法删除  ' },
  LOCK_CONFLICT:        { code: 3013,  message: '  时间段已被锁定  ' },
  CONFIRM_REQUIRED:     { code: 3014,  message: '  订单需要先支付定金  ' },
  DATE_NOT_AVAILABLE:   { code: 3015,  message: '  该日期不在项目可选范围内  ' },

  INTERNAL_ERROR:       { code: 5000,  message: '  服务器开小差了  ' },
  DB_ERROR:             { code: 5001,  message: '  数据库异常  ' },
};

module.exports = ERROR_CODES;
