const service = require('./schedule.service');
const logger = require('../../shared/logger');

/** GET /booked-times */
async function getBookedTimes(req, res) {
  try {
    const { mId, date, studioId } = req.query;
    if (!mId || !date || !studioId) return res.rh.fail('缺少必要参数', 400);
    const result = await service.getBookedTimes(mId, parseInt(studioId), date);
    res.rh.success(result);
  } catch (err) {
    logger.error('getBookedTimes error', err);
    res.rh.error('查询失败');
  }
}

/** GET /unavailable-slots/grid */
async function getUnavailableGrid(req, res) {
  try {
    const { mId, studioId, date } = req.query;
    const result = await service.getUnavailableGrid(mId, parseInt(studioId), date);
    res.rh.success(result);
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('getUnavailableGrid error', err);
    res.rh.error('查询失败');
  }
}

/** POST /unavailable-slots/save */
async function saveUnavailableSlots(req, res) {
  try {
    const { mId, studioId, date, slots, slotsEnd } = req.body;
    const result = await service.saveUnavailableSlots(mId, studioId, date, slots, slotsEnd);
    res.rh.success(result, '不可接单时段已保存');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('saveUnavailableSlots error', err);
    res.rh.error('保存失败');
  }
}

// ════════════════════════════════════════
//  Excel 导入导出 Controller
// ════════════════════════════════════════

async function downloadTemplate(req, res) {
  try {
    const { buffer, fileName } = await service.downloadTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    logger.error('downloadTemplate error', err);
    res.rh.error('下载失败');
  }
}

async function importExcel(req, res) {
  try {
    if (!req.file) return res.rh.fail('请选择要上传的 Excel 文件', 400);
    const mId = req.user.mId;
    const result = await service.importExcel(req.file.path, req.file.originalname, mId);
    res.rh.success(result, '导入完成');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('importExcel error', err);
    res.rh.error('导入失败');
  }
}

async function listBatches(req, res) {
  try {
    const mId = req.user.mId;
    const { batch_id, status, page, pageSize } = req.query;
    const result = await service.listImportBatches(mId, { batch_id, status, page: Number(page) || 1, pageSize: Number(pageSize) || 20 });
    res.rh.success(result);
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('listBatches error', err);
    res.rh.error('查询失败');
  }
}

async function getBatchDetail(req, res) {
  try {
    const mId = req.user.mId;
    const { batchId } = req.params;
    const rows = await service.getBatchDetail(batchId, mId);
    res.rh.success({ batchId, rows, count: rows.length });
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('getBatchDetail error', err);
    res.rh.error('查询失败');
  }
}

async function exportData(req, res) {
  try {
    const mId = req.user.mId;
    const { batch_id, status } = req.query;
    const { buffer, fileName } = await service.exportData(mId, { batch_id, status });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    logger.error('exportData error', err);
    res.rh.error('导出失败');
  }
}

module.exports = {
  getBookedTimes, getUnavailableGrid, saveUnavailableSlots,
  downloadTemplate, importExcel, listBatches, getBatchDetail, exportData,
};
