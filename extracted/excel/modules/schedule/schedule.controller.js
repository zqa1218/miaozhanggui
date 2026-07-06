const service = require('./schedule.service');
const logger = require('../../shared/logger');

/** GET /booked-times */
async function getBookedTimes(req, res) {
  try {
    const { mId, date, studioId } = req.query;
    if (!mId || !date || !studioId) {
      return res.rh.fail({ code: 1001, message: '  缺少必要参数  ' });
    }
    const result = await service.getBookedTimes(mId, parseInt(studioId), date);
    res.rh.success(result);
  } catch (err) {
    logger.error('getBookedTimes error', err);
    res.rh.error({ code: 5000 });
  }
}

/** GET /unavailable-slots/grid */
async function getUnavailableGrid(req, res) {
  try {
    const { mId, studioId, date } = req.query;
    const result = await service.getUnavailableGrid(mId, parseInt(studioId), date);
    res.rh.success(result);
  } catch (err) {
    if (err.isOperational) return res.rh.fail({ code: err.code, message: err.message }, err.message);
    logger.error('getUnavailableGrid error', err);
    res.rh.error({ code: 5000 });
  }
}

/** POST /unavailable-slots/save */
async function saveUnavailableSlots(req, res) {
  try {
    const { mId, studioId, date, slots } = req.body;
    const result = await service.saveUnavailableSlots(mId, studioId, date, slots);
    res.rh.success(result, '  不可接单时段已保存  ');
  } catch (err) {
    if (err.isOperational) return res.rh.fail({ code: err.code, message: err.message }, err.message);
    logger.error('saveUnavailableSlots error', err);
    res.rh.error({ code: 5000 });
  }
}

// ============================================================
//  Excel 导入导出 Controller
// ============================================================

/** GET /excel/template — 下载导入模板 */
async function downloadTemplate(req, res) {
  try {
    const { buffer, fileName } = await service.downloadTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    logger.error('downloadTemplate error', err);
    res.rh.error({ code: 5000 });
  }
}

/** POST /excel/import — 上传 Excel 批量导入 */
async function importExcel(req, res) {
  try {
    if (!req.file) {
      return res.rh.fail({ code: 1001, message: '请选择要上传的 Excel 文件' });
    }
    const merchantId = req.user.merchantId;
    const result = await service.importExcel(req.file.path, req.file.originalname, merchantId);
    res.rh.success(result, '导入完成');
  } catch (err) {
    if (err.isOperational) return res.rh.fail({ code: err.code, message: err.message });
    logger.error('importExcel error', err);
    res.rh.error({ code: 5000 });
  }
}

/** GET /excel/batches — 查询导入批次列表 */
async function listBatches(req, res) {
  try {
    const merchantId = req.user.merchantId;
    const { batch_id, status, page, pageSize } = req.query;
    const result = await service.listImportBatches(merchantId, {
      batch_id, status,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    });
    res.rh.success(result);
  } catch (err) {
    if (err.isOperational) return res.rh.fail({ code: err.code, message: err.message });
    logger.error('listBatches error', err);
    res.rh.error({ code: 5000 });
  }
}

/** GET /excel/batches/:batchId — 查询批次详情 */
async function getBatchDetail(req, res) {
  try {
    const merchantId = req.user.merchantId;
    const { batchId } = req.params;
    const rows = await service.getBatchDetail(batchId, merchantId);
    res.rh.success({ batchId, rows, count: rows.length });
  } catch (err) {
    if (err.isOperational) return res.rh.fail({ code: err.code, message: err.message });
    logger.error('getBatchDetail error', err);
    res.rh.error({ code: 5000 });
  }
}

/** GET /excel/export — 导出数据为 Excel */
async function exportData(req, res) {
  try {
    const merchantId = req.user.merchantId;
    const { batch_id, status } = req.query;
    const { buffer, fileName } = await service.exportData(merchantId, { batch_id, status });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    logger.error('exportData error', err);
    res.rh.error({ code: 5000 });
  }
}

module.exports = {
  getBookedTimes, getUnavailableGrid, saveUnavailableSlots,
  downloadTemplate, importExcel, listBatches, getBatchDetail, exportData,
};
