const AppError = require('../../shared/errors/AppError');
const ERROR_CODES = require('../../shared/errors/errorCodes');
const orderRepo = require('../order/order.repository');
const notificationRepo = require('../notification/notification.repository');

// 允许申请退款的状态
const REFUNDABLE_STATUSES = ['待支付', '已付定金', '尾款待确认', '已结清'];

async function applyCancel(orderNo, mId, refundText, refundImgUrl) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.m_id !== mId) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '  订单不属于该商家  ');

  if (!REFUNDABLE_STATUSES.includes(order.status)) {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, `  订单当前状态「${order.status}」不可申请退款  `);
  }

  // 写入退款信息 + 记录原始状态
  await orderRepo.updateRefundInfo(orderNo, refundText || '', refundImgUrl || '', order.status);

  //   通知商家
  setImmediate(async () => {
    try {
      await notificationRepo.insert({
        m_id: mId,
        title: '  退款申请',
        content: `订单 ${orderNo} (${order.studio_title}) 申请退款`,
        type: 'warning',
        order_no: orderNo,
      });
    } catch (_) {}
  });

  return { success: true };
}

async function rejectRefund(orderNo, mId, reason) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.m_id !== mId) throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '  订单不属于该商家  ');

  if (order.status !== '退款审核中') {
    throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '  当前状态不允许拒绝退款  ');
  }

  // 恢复到退款前状态（从 original_status 读取，兜底为已付定金）
  await orderRepo.rejectRefund(orderNo, reason || '');

  //   通知用户
  setImmediate(async () => {
    try {
      await notificationRepo.insert({
        m_id: mId,
        title: '  退款已拒绝',
        content: `订单 ${orderNo} 退款申请已被拒绝${reason ? '：' + reason : ''}`,
        type: 'danger',
        order_no: orderNo,
      });
    } catch (_) {}
  });

  return { success: true };
}

module.exports = { applyCancel, rejectRefund, approveRefund, getRefundList };

async function approveRefund(orderNo, mId) {
  const order = await orderRepo.findByOrderNo(orderNo);
  if (!order) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404);
  if (order.m_id !== mId) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);
  if (order.status !== '退款审核中') throw new AppError(ERROR_CODES.STATUS_NOT_ALLOWED, 400, '  当前状态不允许退款  ');

  const knex = require('../../shared/database/knex');
  await knex('orders').where('order_no', orderNo).update({
    status: '已退款取消', original_status: null, updated_at: knex.fn.now(),
  });

  // 释放时段
  const scheduleRepo = require('../schedule/schedule.repository');
  await scheduleRepo.deleteSlotsByOrderNo(null, orderNo);

  // 通知
  setImmediate(async () => {
    try {
      await notificationRepo.insert({
        m_id: mId, title: '  退款已通过', content: `订单 ${orderNo} 退款已通过`, type: 'success', order_no: orderNo,
      });
    } catch (_) {}
  });

  return { success: true };
}

async function getRefundList(mId) {
  const knex = require('../../shared/database/knex');
  const rows = await knex('orders')
    .where({ m_id: mId, status: '退款审核中' })
    .orderBy('updated_at', 'desc');
  return rows.map((row) => ({
    id: row.id,
    orderNo: row.order_no,
    studioTitle: row.studio_title,
    date: row.order_date,
    totalPrice: row.total_price,
    depositAmount: row.deposit_amount,
    contact: row.contact_info,
    refundText: row.refund_text,
    refundImgUrl: row.refund_img_url,
    originalStatus: row.original_status || '',
    status: row.status,
    createdAt: row.created_at,
  }));
}
