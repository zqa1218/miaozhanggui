const service = require('./log.service');
const logger = require('../../shared/logger');

async function getList(req, res) {
  try {
    const result = await service.getList(req.query.mId);
    res.rh.success(result);
  } catch (err) {
    logger.error('getLogs error', err);
    res.rh.error('查询失败');
  }
}

async function addLog(req, res) {
  try {
    const result = await service.addLog(req.body.mId, req.body.action);
    res.rh.success(result);
  } catch (err) {
    logger.error('addLog error', err);
    res.rh.error('操作失败');
  }
}

async function clearLogs(req, res) {
  try {
    const result = await service.clearLogs(req.body.mId);
    res.rh.success(result, '日志已清空');
  } catch (err) {
    logger.error('clearLogs error', err);
    res.rh.error('操作失败');
  }
}

module.exports = { getList, addLog, clearLogs };
