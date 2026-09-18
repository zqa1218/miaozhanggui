const service = require('./clientOrder.service');
const logger = require('../../shared/logger');

function deviceIdOf(req) {
  return req.deviceId || req.headers['x-device-id'] || '';
}

/** POST /client/order/create — 顾客下单 */
async function createOrder(req, res) {
  try {
    const result = await service.createOrder(req.body, req.user.userId);
    res.rh.success(result, result.idempotent ? '订单已存在' : '订单创建成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('[client-order] createOrder error:', err.message);
    res.rh.error('创建订单失败');
  }
}

/** GET /client/orders — 我的订单 */
async function listOrders(req, res) {
  try {
    const result = await service.listOrders(req.user.userId, req.query);
    res.rh.success(result);
  } catch (err) {
    logger.error('[client-order] listOrders error:', err.message);
    res.rh.error('查询订单失败');
  }
}

/** GET /client/orders/:orderNo — 订单详情 */
async function getDetail(req, res) {
  try {
    const result = await service.getDetail(req.params.orderNo, req.user.userId, deviceIdOf(req));
    res.rh.success(result);
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('[client-order] getDetail error:', err.message);
    res.rh.error('查询订单详情失败');
  }
}

/** GET /client/orders/:orderNo/timeline — 状态时间线 */
async function getTimeline(req, res) {
  try {
    const result = await service.getTimeline(req.params.orderNo, req.user.userId, deviceIdOf(req));
    res.rh.success(result);
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('[client-order] getTimeline error:', err.message);
    res.rh.error('查询状态时间线失败');
  }
}

/** GET /client/orders/:orderNo/payments — 支付流水 */
async function getPayments(req, res) {
  try {
    const result = await service.getPayments(req.params.orderNo, req.user.userId, deviceIdOf(req));
    res.rh.success(result);
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('[client-order] getPayments error:', err.message);
    res.rh.error('查询支付流水失败');
  }
}

/** POST /client/order/:orderNo/cancel — 发起取消申请 */
async function cancel(req, res) {
  try {
    const result = await service.cancel(req.params.orderNo, req.user.userId, deviceIdOf(req));
    res.rh.success(result, '取消申请已提交');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('[client-order] cancel error:', err.message);
    res.rh.error('申请失败');
  }
}

module.exports = { createOrder, listOrders, getDetail, getTimeline, getPayments, cancel };
