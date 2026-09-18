/**
 * 顾客端（微信小程序）订单服务 —— 复用 order.service 全链路
 * 只做「归属注入 + 幂等 + 确定性 deviceId」，不改变既有下单/查单逻辑。
 */
const orderService = require('../order/order.service');

/** 顾客下单：复用 createOrderV2，注入 userId + 确定性 userDeviceId */
async function createOrder(payload, userId) {
  const finalPayload = {
    ...payload,
    userId,
    // 登录用户确定性 deviceId（兼容 orders.user_device_id NOT NULL 与旧归属校验）
    userDeviceId: payload.userDeviceId || ('mp_' + userId),
  };
  return orderService.createOrderV2(finalPayload);
}

/** 我的订单（按 user_id，跨商户可不传 mId） */
async function listOrders(userId, query = {}) {
  return orderService.getClientOrders({
    userId,
    mId: query.mId,
    status: query.status,
    page: query.page,
    size: query.size,
  });
}

/** 订单详情 + 归属校验 */
async function getDetail(orderNo, userId, deviceId) {
  return orderService.getClientOrderDetail(orderNo, userId, deviceId);
}

/** 订单状态时间线 */
async function getTimeline(orderNo, userId, deviceId) {
  return orderService.getOrderTimeline(orderNo, userId, deviceId);
}

/** 订单支付流水 */
async function getPayments(orderNo, userId, deviceId) {
  return orderService.getOrderPayments(orderNo, userId, deviceId);
}

/** 发起取消申请 */
async function cancel(orderNo, userId, deviceId) {
  return orderService.requestCancelByUser(orderNo, userId, deviceId);
}

module.exports = { createOrder, listOrders, getDetail, getTimeline, getPayments, cancel };
