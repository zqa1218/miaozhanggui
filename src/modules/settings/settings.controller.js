const service = require('./settings.service');
const logger = require('../../shared/logger');

async function getSettings(req, res) {
  try {
    const result = await service.getSettings(req.query.mId);
    if (!result) return res.rh.fail('商家不存在', 404);
    res.rh.success(result);
  } catch (err) {
    logger.error('getSettings error', err);
    res.rh.error('查询失败');
  }
}

async function saveSettings(req, res) {
  try {
    const result = await service.saveSettings(req.body);
    res.rh.success(result, '设置已保存');
  } catch (err) {
    logger.error('saveSettings error', err);
    res.rh.error('保存失败');
  }
}

module.exports = { getSettings, saveSettings };
