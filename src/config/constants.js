/**
 *   业务常量定义
 */
const ORDER_STATUS = {
  PENDING_PAY:     '待支付',
  DEPOSIT_PAID:    '已付定金',
  FINAL_WAITING:   '尾款待确认',
  FULLY_PAID:      '已结清',
  COMPLETED:       '已完成拍摄',
  CANCELLED:       '已取消',
  REFUND_REVIEW:   '退款审核中',
  REFUNDED:        '已退款取消',
};

const ORDER_ARCHIVE_TYPES = {
  COMPLETED:       '已完成拍摄',
  CANCELLED:       '已取消',
  REFUND_APPROVED: '已退款取消',
};

const SHOP_MODE = {
  STUDIO:        'studio',
  PHOTOGRAPHER:  'photographer',
};

const CALC_MODE = {
  TIME:      'time',
  PHOTO:     'photo',
  PHOTO_TIME: 'photo_time',
};

const DEPOSIT_RATIOS = [5, 10, 30, 50, 100];

const RESCHEDULE_STATUS = {
  PENDING:  '待处理',
  APPROVED: '已同意',
  REJECTED: '已拒绝',
};

const NOTIFICATION_TYPE = {
  INFO:    'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER:  'danger',
};

module.exports = {
  ORDER_STATUS,
  ORDER_ARCHIVE_TYPES,
  SHOP_MODE,
  CALC_MODE,
  DEPOSIT_RATIOS,
  RESCHEDULE_STATUS,
  NOTIFICATION_TYPE,
};
