const service = require('./studio.service');
const logger = require('../../shared/logger');

/** GET /studios-lite */
async function getLiteList(req, res) {
  try {
    const { mId } = req.query;
    if (!mId) return res.rh.fail('缺少 mId 参数', 400);
    const list = await service.getLiteList(mId);
    res.rh.success(list);
  } catch (err) {
    logger.error('getLiteList error', err);
    res.rh.error('查询项目失败');
  }
}

/** GET /studios */
async function getFullList(req, res) {
  try {
    const mId = req.query.mId || (req.user && req.user.mId);
    if (!mId) return res.rh.fail('缺少 mId 参数', 400);
    const list = await service.getFullList(mId);
    res.rh.success(list);
  } catch (err) {
    logger.error('getFullList error', err);
    res.rh.error('查询项目失败');
  }
}

/** POST /add-studio */
async function create(req, res) {
  try {
    const result = await service.create(req.body);
    res.rh.success(result, '项目上架成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('create studio error', err);
    res.rh.error('上架失败');
  }
}

/** POST /edit-studio */
async function update(req, res) {
  try {
    const result = await service.update(req.body);
    res.rh.success(result, '项目更新成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('update studio error', err);
    res.rh.error('更新失败');
  }
}

/** POST /delete-studio */
async function remove(req, res) {
  try {
    const id = req.body.id;
    const mId = req.body.mId || (req.user && req.user.mId);
    if (!mId) return res.rh.fail('缺少商家身份', 401);
    const result = await service.remove(id, mId);
    res.rh.success(result, '项目已下架');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('delete studio error', err);
    res.rh.error('下架失败');
  }
}

/** POST /update-studio-order */
async function updateOrder(req, res) {
  try {
    const mId = req.user && req.user.mId;
    if (!mId) return res.rh.fail('缺少商家身份', 401);
    const result = await service.updateStudioOrder(mId, req.body.orderedList);
    res.rh.success(result, '排序已更新');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('updateOrder error', err);
    res.rh.error('排序更新失败');
  }
}

/** POST /studio/:studioId/remove-image */
async function removeImage(req, res) {
  try {
    const mId = req.user && req.user.mId;
    if (!mId) return res.rh.fail('缺少商家身份', 401);
    const { studioId } = req.params;
    const { imageUrl, imageType } = req.body;
    await service.removeStudioImage(mId, studioId, imageUrl, imageType);
    res.rh.success(null, '图片已删除');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('removeImage error', err);
    res.rh.error('图片删除失败');
  }
}

module.exports = { getLiteList, getFullList, create, update, remove, updateOrder, removeImage };
