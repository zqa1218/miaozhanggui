const service = require('./admin.service');
const logger = require('../../shared/logger');

/** POST /admin/invitation-codes/generate */
async function generateCodes(req, res) {
  try {
    const count = parseInt(req.body.count) || 1;
    const result = await service.generateCodes(count);
    res.rh.success(result, `成功生成 ${result.count} 个邀请码`);
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('generateCodes error', err);
    res.rh.error('生成邀请码失败');
  }
}

/** GET /admin/invitation-codes */
async function listCodes(req, res) {
  try {
    const { page, pageSize, isUsed } = req.query;
    const result = await service.listCodes({ page, pageSize, isUsed });
    res.rh.success(result);
  } catch (err) {
    logger.error('listCodes error', err);
    res.rh.error('查询邀请码失败');
  }
}

/** GET /admin/merchants */
async function listMerchants(req, res) {
  try {
    const { page, pageSize, keyword } = req.query;
    const result = await service.listMerchants({ page, pageSize, keyword });
    res.rh.success(result);
  } catch (err) {
    logger.error('listMerchants error', err);
    res.rh.error('查询商家列表失败');
  }
}

module.exports = { generateCodes, listCodes, listMerchants };
