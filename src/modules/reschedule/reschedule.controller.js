const service = require('./reschedule.service');
const logger = require('../../shared/logger');

async function apply(req, res) {
  try {
    const result = await service.apply(req.body);
    res.rh.success(result);
  } catch (err) {
    logger.error('reschedule apply error', err);
    res.rh.error('申请失败');
  }
}

async function list(req, res) {
  try {
    const result = await service.list(req.user.mId, req.query.status);
    res.rh.success(result);
  } catch (err) {
    logger.error('reschedule list error', err);
    res.rh.error('查询失败');
  }
}

async function approve(req, res) {
  try {
    const result = await service.approve(req.body.requestId, req.user.mId);
    res.rh.success(result, '已同意改期');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('reschedule approve error', err);
    res.rh.error('操作失败');
  }
}

async function reject(req, res) {
  try {
    const result = await service.reject(req.body.requestId, req.user.mId, req.body.reason || '');
    res.rh.success(result, '已拒绝改期');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('reschedule reject error', err);
    res.rh.error('操作失败');
  }
}

async function getStatusByOrder(req, res) {
  try {
    const result = await service.getByOrderNo(req.query.orderNo, req.query.mId);
    res.rh.success(result);
  } catch (err) {
    logger.error('reschedule status error', err);
    res.rh.error('查询失败');
  }
}

module.exports = { apply, list, approve, reject, getStatusByOrder };
