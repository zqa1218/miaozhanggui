const service = require('./refund.service');
const logger = require('../../shared/logger');

async function applyCancel(req, res) {
  try {
    const result = await service.applyCancel(req.body.orderNo, req.body.mId, req.body.refundText, req.body.refundImgUrl);
    res.rh.success(result, '退款申请已提交');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('applyCancel error', err);
    res.rh.error('提交失败');
  }
}

async function rejectRefund(req, res) {
  try {
    const result = await service.rejectRefund(req.body.orderNo, req.user.mId, req.body.reason);
    res.rh.success(result, '已拒绝退款');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('rejectRefund error', err);
    res.rh.error('操作失败');
  }
}

async function approveRefund(req, res) {
  try {
    const result = await service.approveRefund(req.body.orderNo, req.user.mId);
    res.rh.success(result, '退款已通过');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('approveRefund error', err);
    res.rh.error('操作失败');
  }
}

async function getRefundList(req, res) {
  try {
    const result = await service.getRefundList(req.user.mId);
    res.rh.success(result);
  } catch (err) {
    logger.error('getRefundList error', err);
    res.rh.error('查询失败');
  }
}

module.exports = { applyCancel, rejectRefund, approveRefund, getRefundList };
