const service = require('./order.service');
const logger = require('../../shared/logger');

/** POST /create-order (旧版兼容) */
async function createOrder(req, res) {
  try {
    // 检测新版 payload: 如果有 bookingStartTime 则走 V2
    if (req.body.bookingStartTime) {
      const result = await service.createOrderV2(req.body);
      return res.rh.success(result, '订单创建成功');
    }
    const result = await service.createOrder(req.body);
    res.rh.success(result, '订单创建成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('createOrder error', err);
    res.rh.error('创建订单失败');
  }
}

/** POST /create-order-v2 (显式 V2) */
async function createOrderV2(req, res) {
  try {
    const payload = { ...req.body };
    if (req.user && req.user.userId) payload.userId = req.user.userId;

    const result = await service.createOrderV2(payload);
    res.rh.success(result, '订单创建成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('createOrderV2 error', err);
    res.rh.error('创建订单失败');
  }
}

/** GET /orders */
async function getOrders(req, res) {
  try {
    const { mId, status, date, studioId, search, page, pageSize } = req.query;
    console.log('====== [BUG DIAGNOSIS] GET /orders 收到请求 ======');
    console.log('  req.user:', JSON.stringify(req.user || {}));
    console.log('  query.mId:', mId);
    console.log('  query.status:', status);
    console.log('  query.date:', date);

    const result = await service.getOrders(mId, { status, date, studioId, search, page, pageSize });
    console.log('====== [BUG DIAGNOSIS] GET /orders 返回结果 total:', result?.total, 'list:', result?.list?.length);
    res.rh.success(result);
  } catch (err) {
    console.error('====== [CRITICAL BREAKDOWN] getOrders:', err.message, err.stack);
    logger.error('getOrders error', err);
    res.rh.error('查询订单失败');
  }
}

/** GET /my-orders — 支持 JWT 用户隔离 与 旧版 deviceId 兼容 */
async function getMyOrders(req, res) {
  try {
    const { mId, userDeviceId } = req.query;

    // ★ 新鉴权：已登录用户 → userId + mId 双重隔离
    if (req.user && req.user.userId) {
      if (!mId) return res.rh.fail('缺少商家ID', 400);
      const list = await service.getMyOrdersByUser(mId, req.user.userId);
      return res.rh.success(list);
    }

    // 旧版兼容：deviceId 查询
    const list = await service.getMyOrders(mId, userDeviceId);
    res.rh.success(list);
  } catch (err) {
    logger.error('getMyOrders error', err);
    res.rh.error('查询订单失败');
  }
}

/** POST /update-status */
async function updateStatus(req, res) {
  try {
    const mId = (req.user && req.user.mId) || req.body.mId;
    const result = await service.updateStatus(req.body.orderNo, req.body.status, mId);
    res.rh.success(result, '状态已更新');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('updateStatus error', err);
    res.rh.error('更新状态失败');
  }
}

/** POST /archive-order */
async function archiveOrder(req, res) {
  try {
    const result = await service.archiveOrder(req.body.orderNo, req.body.type, req.user.mId);
    res.rh.success(result, '归档成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('archiveOrder error', err);
    res.rh.error('归档失败');
  }
}

/** GET /order-stats */
async function getTodayStats(req, res) {
  try {
    const result = await service.getTodayStats(req.query.mId);
    res.rh.success(result);
  } catch (err) {
    logger.error('getTodayStats error', err);
    res.rh.error('查询统计失败');
  }
}

/** GET /order-detail */
async function getOrderDetail(req, res) {
  try {
    const result = await service.getOrderDetail(req.query.orderNo, req.query.mId);
    res.rh.success(result);
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('getOrderDetail error', err);
    res.rh.error('查询详情失败');
  }
}

/** POST /pay-deposit */
async function payDeposit(req, res) {
  try {
    const result = await service.payDeposit(req.body.orderNo, req.body.mId);
    res.rh.success(result, '定金支付确认');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('payDeposit error', err);
    res.rh.error('操作失败');
  }
}

/** POST /pay-final */
async function payFinal(req, res) {
  try {
    const result = await service.payFinal(req.body.orderNo, req.body.mId);
    res.rh.success(result, '尾款支付确认');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('payFinal error', err);
    res.rh.error('操作失败');
  }
}

/** POST /order/confirm-lock — 摄影师确认锁定 */
async function confirmLock(req, res) {
  try {
    const result = await service.confirmLock(req.body.orderNo, req.body.mId);
    res.rh.success(result, '订单已确认锁定');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('confirmLock error', err);
    res.rh.error('确认锁定失败');
  }
}

/** GET /booked-times-v2 — 查询高精度占位（studioId 可选，支持 excludeOrderNo） */
async function getBookedTimesV2(req, res) {
  try {
    const { mId, studioId, date, excludeOrderNo } = req.query;
    if (!mId || !date) return res.rh.fail('缺少 mId 或 date 参数', 400);
    const result = await service.getBookedTimesV2(mId, studioId || null, date, excludeOrderNo || '');
    res.rh.success(result);
  } catch (err) {
    logger.error('getBookedTimesV2 error', err);
    res.rh.error('查询占用失败');
  }
}

// ════════════════════════════════════════
//  状态机 API Controller
// ════════════════════════════════════════

// 管理端：确认收到定金
async function confirmDepositPaid(req, res) {
  try {
    const result = await service.confirmDepositPaid(req.body.orderNo, req.user.mId);
    res.rh.success(result, '已标记为已付定金');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('confirmDepositPaid error', err);
    res.rh.error('操作失败');
  }
}

// 管理端：确认结清
async function confirmCompleted(req, res) {
  try {
    const result = await service.confirmCompleted(req.body.orderNo, req.user.mId);
    res.rh.success(result, '已标记为已结清');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('confirmCompleted error', err);
    res.rh.error('操作失败');
  }
}

// 管理端：标记服务完成
async function markFulfilled(req, res) {
  try {
    const result = await service.markFulfilled(req.body.orderNo, req.user.mId);
    res.rh.success(result, '已标记为服务完成');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('markFulfilled error', err);
    res.rh.error('操作失败');
  }
}

// 用户端：申请改期
async function requestReschedule(req, res) {
  try {
    const deviceId = req.deviceId || req.headers['x-device-id'];
    const result = await service.requestReschedule(req.body.orderNo, deviceId, req.body.requestedNewTime);
    res.rh.success(result, '改期申请已提交');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('requestReschedule error', err);
    res.rh.error('申请失败');
  }
}

// 管理端：同意改期
async function approveReschedule(req, res) {
  try {
    const result = await service.approveReschedule(req.body.orderNo, req.user.mId);
    res.rh.success(result, '改期已通过');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('approveReschedule error', err);
    res.rh.error('操作失败');
  }
}

// 管理端：拒绝改期
async function rejectReschedule(req, res) {
  try {
    const result = await service.rejectReschedule(req.body.orderNo, req.user.mId);
    res.rh.success(result, '改期已拒绝');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('rejectReschedule error', err);
    res.rh.error('操作失败');
  }
}

// 用户端：申请取消
async function requestCancel(req, res) {
  try {
    const deviceId = req.deviceId || req.headers['x-device-id'];
    const result = await service.requestCancel(req.body.orderNo, deviceId);
    res.rh.success(result, '取消申请已提交');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('requestCancel error', err);
    res.rh.error('申请失败');
  }
}

// 管理端：同意取消
async function approveCancel(req, res) {
  try {
    const result = await service.approveCancel(req.body.orderNo, req.user.mId);
    res.rh.success(result, '已取消并释放时段');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('approveCancel error', err);
    res.rh.error('操作失败');
  }
}

// 管理端：拒绝取消
async function rejectCancel(req, res) {
  try {
    const result = await service.rejectCancel(req.body.orderNo, req.user.mId);
    res.rh.success(result, '已拒绝取消申请');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('rejectCancel error', err);
    res.rh.error('操作失败');
  }
}

/** GET /order/import-template — 下载订单导入空白模板 */
async function downloadImportTemplate(req, res) {
  try {
    const excelHelper = require('../../shared/utils/excelHelper');
    const buffer = excelHelper.generateOrderTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'%E9%A2%84%E7%BA%A6%E8%AE%A2%E5%8D%95%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF.xlsx');
    res.send(buffer);
  } catch (err) {
    console.error('downloadImportTemplate error:', err.message, err.stack);
    logger.error('downloadImportTemplate error', err);
    res.rh.error('下载模板失败: ' + err.message);
  }
}

/** GET /order/export — 导出当前订单为 Excel */
async function exportOrders(req, res) {
  try {
    const { mId, date, status } = req.query;
    if (!mId) return res.rh.fail('缺少 mId', 400);
    const result = await service.getOrders(mId, { date, status, page: 1, pageSize: 500 });
    const excelHelper = require('../../shared/utils/excelHelper');
    const buffer = excelHelper.exportOrdersToExcel(result.list || []);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''%E5%95%86%E5%AE%B6%E8%AE%A2%E5%8D%95%E6%8A%A5%E8%A1%A8_${today}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('exportOrders error:', err.message);
    logger.error('exportOrders error', err);
    res.rh.error('导出失败: ' + err.message);
  }
}

/** POST /order/import — Excel 批量导入订单 */
async function importOrders(req, res) {
  try {
    if (!req.file) return res.rh.fail('请选择 Excel 文件', 400);
    const mId = req.user.mId;
    const result = await service.importOrders(req.file.path, req.file.originalname, mId);
    res.rh.success(result);
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('importOrders error', err);
    res.rh.error('导入失败: ' + (err.message || '未知错误'));
  }
}

// 管理端：确认未结清尾款回收
async function confirmSettled(req, res) {
  try {
    const result = await service.confirmSettled(req.body.orderNo, req.user.mId);
    res.rh.success(result, '尾款已结清，订单已完成');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('confirmSettled error', err);
    res.rh.error('结清失败: ' + (err.message || '未知错误'));
  }
}

// 管理端：恢复已取消订单
async function restoreOrder(req, res) {
  try {
    const result = await service.restoreOrder(req.body.orderNo, req.user.mId);
    res.rh.success(result, '订单已恢复，时段已重新锁定');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    console.error('restoreOrder error:', err.message, err.stack);
    logger.error('restoreOrder error', err);
    res.rh.error('恢复失败: ' + (err.message || '未知错误'));
  }
}

// 管理端：永久删除已取消订单
async function deleteOrder(req, res) {
  try {
    await service.deleteOrder(req.body.orderNo, req.user.mId);
    res.rh.success(null, '订单已永久删除');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('deleteOrder error', err);
    res.rh.error('删除失败: ' + (err.message || '未知错误'));
  }
}

/** POST /order/verify-address */
async function verifyAddress(req, res) {
  try {
    const result = await service.verifyAddress(req.body.orderNo, req.body.valid);
    res.rh.success(result, req.body.valid ? '已标记地址正确' : '已标记地址不正确');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('verifyAddress error', err);
    res.rh.error('验证失败');
  }
}

// 管理端：批量清除已完成订单
async function clearCompleted(req, res) {
  try {
    const result = await service.clearCompletedOrders(req.user.mId);
    res.rh.success(result, `已清除 ${result.deleted} 条已完成订单`);
  } catch (err) {
    logger.error('clearCompleted error', err);
    res.rh.error('清除失败: ' + (err.message || '未知错误'));
  }
}

module.exports = {
  createOrder, createOrderV2,
  getOrders, getMyOrders, updateStatus, archiveOrder,
  getTodayStats, getOrderDetail,
  payDeposit, payFinal, confirmLock,
  getBookedTimesV2,
  confirmDepositPaid, confirmCompleted, confirmSettled, markFulfilled,
  requestReschedule, approveReschedule, rejectReschedule,
  requestCancel, approveCancel, rejectCancel,
  restoreOrder,
  deleteOrder,
  verifyAddress,
  clearCompleted,
  downloadImportTemplate, exportOrders, importOrders,
};
