const service = require('./style.service');
const logger = require('../../shared/logger');

/** GET /styles */
async function getList(req, res) {
  try {
    const mId = req.query.mId || (req.user && req.user.mId);
    if (!mId) return res.rh.fail('缺少 mId 参数', 400);
    const list = await service.getList(mId);
    res.rh.success(list);
  } catch (err) {
    logger.error('getStyleList error', err);
    res.rh.error('查询样式失败');
  }
}

/** POST /styles */
async function create(req, res) {
  try {
    const result = await service.create(req.body);
    res.rh.success(result, '样式创建成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('create style error', err);
    res.rh.error('创建样式失败');
  }
}

/** POST /styles/edit */
async function update(req, res) {
  try {
    const result = await service.update(req.body);
    res.rh.success(result, '样式更新成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('update style error', err);
    res.rh.error('更新样式失败');
  }
}

/** POST /styles/delete */
async function remove(req, res) {
  try {
    const result = await service.remove(req.body.id, req.body.mId);
    res.rh.success(result, '样式已删除');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('delete style error', err);
    res.rh.error('删除样式失败');
  }
}

module.exports = { getList, create, update, remove };
