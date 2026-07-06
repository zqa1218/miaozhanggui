const service = require('./studio.service');
const logger = require('../../shared/logger');

/** GET /studios-lite (mId 可选，支持 city/keyword 筛选) */
async function getLiteList(req, res) {
  try {
    const { mId, city, keyword } = req.query;
    const filters = {};
    if (mId) filters.mId = mId;
    if (city) filters.city = city;
    if (keyword) filters.keyword = keyword;
    const list = await service.getLiteList(filters);
    res.rh.success(list);
  } catch (err) {
    logger.error('getLiteList error', err);
    res.rh.error('查询项目失败');
  }
}

/** GET /studios/available?date=YYYY-MM-DD */
async function getAvailable(req, res) {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.rh.fail('请提供有效的日期参数 date (YYYY-MM-DD)', 400);
    }
    const list = await service.getAvailable(date);
    res.rh.success(list);
  } catch (err) {
    logger.error('getAvailable error', err);
    res.rh.error('查询可用工作室失败');
  }
}

/** GET /studios-cities */
async function getCities(req, res) {
  try {
    const cities = await service.getDistinctCities();
    res.rh.success(cities);
  } catch (err) {
    logger.error('getCities error', err);
    res.rh.error('获取城市列表失败');
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

module.exports = { getLiteList, getAvailable, getCities, getFullList, create, update, remove };
