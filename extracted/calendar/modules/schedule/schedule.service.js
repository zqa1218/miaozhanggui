const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { AppError } = require('../../shared/errors/AppError');
const { ERROR_CODES } = require('../../shared/errors/errorCodes');
const { generateHalfHourSlots } = require('../../shared/utils/dateHelper');
const repo = require('./schedule.repository');
const studioRepo = require('../studio/studio.repository');
const logger = require('../../shared/logger');

/**
 *   查询已占时段（返回给前端做日历展示）
 *   返回 { bookedMap: {'09:00': true, ...}, packageDayDate: '2026-05-19'|null }
 */
async function getBookedTimes(mId, studioId, date) {
  const [bookedRows, unavailableRows, packageRow] = await Promise.all([
    repo.getBookedSlots(mId, studioId, date),
    repo.getUnavailableSlots(mId, studioId, date),
    repo.hasPackageDayBooking(mId, studioId, date),
  ]);

  const bookedMap = {};
  bookedRows.forEach((r) => { bookedMap[r.time_slot] = true; });
  unavailableRows.forEach((r) => { bookedMap[r.time_slot] = true; });

  return {
    bookedMap,
    packageDayDate: packageRow ? packageRow.booking_date : null,
  };
}

/**
 *   获取不可接单网格（半小时粒度）
 */
async function getUnavailableGrid(mId, studioId, date) {
  const studio = await studioRepo.findByIdAndMerchant(studioId, mId);
  if (!studio) throw new AppError(ERROR_CODES.STUDIO_NOT_FOUND, 404);

  const allSlots = generateHalfHourSlots(studio.open_time, studio.close_time);
  const disabledRows = await repo.getUnavailableSlots(mId, studioId, date);
  const disabledSet = new Set(disabledRows.map((r) => r.time_slot));

  return allSlots.map((slot) => ({
    slot,
    disabled: disabledSet.has(slot),
  }));
}

/**
 *   保存不可接单时段
 */
async function saveUnavailableSlots(mId, studioId, date, slots) {
  const studio = await studioRepo.findByIdAndMerchant(studioId, mId);
  if (!studio) throw new AppError(ERROR_CODES.STUDIO_NOT_FOUND, 404);

  const knex = require('../../shared/database/knex');
  await knex.transaction(async (trx) => {
    await repo.replaceUnavailableSlots(trx, mId, studioId, date, slots);
  });

  return { success: true };
}

// ============================================================
//  Excel 导入导出 Service
// ============================================================

/**
 * 生成模板文件路径，返回可供下载的 Buffer 及文件名
 */
async function downloadTemplate() {
  const excelHelper = require('../../shared/utils/excelHelper');
  const buffer = excelHelper.generateTemplateBuffer();
  const fileName = `排期导入模板_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { buffer, fileName };
}

/**
 * 解析并导入 Excel 文件
 */
async function importExcel(filePath, originalName, merchantId) {
  const excelHelper = require('../../shared/utils/excelHelper');
  const ext = path.extname(originalName).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) {
    fs.unlink(filePath, () => {});
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '仅支持 .xlsx 或 .xls 格式的 Excel 文件');
  }

  let parseResult;
  try {
    parseResult = excelHelper.parseUploadedExcel(filePath);
  } finally {
    fs.unlink(filePath, () => {});
  }

  const { validRows, errors, total, successCount, failCount } = parseResult;
  const batchId = `BATCH_${Date.now()}_${uuidv4().slice(0, 8)}`;

  logger.info(`[ExcelImport] 解析完成 batch=${batchId} total=${total} success=${successCount} fail=${failCount}`);

  if (validRows.length === 0) {
    return {
      batchId, total, successCount: 0, failCount, errors,
      message: '所有数据行均有错误，未导入任何数据',
    };
  }

  const insertRows = validRows.map((row) => ({
    batch_id: batchId,
    project: row.project,
    schedule_date: row.schedule_date,
    time_slot_start: row.time_slot_start,
    time_slot_end: row.time_slot_end,
    contact: row.contact,
    remarks: row.remarks,
    merchant_id: merchantId,
    status: 'pending',
  }));

  await repo.batchInsertExcelRows(insertRows);

  await autoMatchStudios(batchId, merchantId);

  return {
    batchId, total, successCount, failCount, errors,
    message: `成功导入 ${successCount} 条，失败 ${failCount} 条`,
  };
}

/** 自动匹配项目名称 → studio 记录 */
async function autoMatchStudios(batchId, merchantId) {
  try {
    const knex = require('../../shared/database/knex');
    const rows = await repo.findRowsByBatchId(batchId, merchantId);
    if (rows.length === 0) return;

    const studios = await knex('studios')
      .where('merchant_id', merchantId)
      .select('id', 'name');

    for (const row of rows) {
      const matched = studios.find(
        (s) => s.name.trim().toLowerCase() === row.project.trim().toLowerCase()
      );
      if (matched) {
        await knex('schedule_excel_imports')
          .where('id', row.id)
          .update({ studio_id: matched.id, studio_name: matched.name });
      }
    }
  } catch (err) {
    logger.warn(`[ExcelImport] 自动匹配项目失败 batch=${batchId}`, err.message);
  }
}

/** 查询导入批次列表（分页） */
async function listImportBatches(merchantId, filters) {
  return repo.findExcelImportBatches(merchantId, filters);
}

/** 查询某批次详情 */
async function getBatchDetail(batchId, merchantId) {
  const rows = await repo.findRowsByBatchId(batchId, merchantId);
  if (rows.length === 0) {
    throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404, '批次不存在或不属于当前商家');
  }
  return rows;
}

/** 导出数据为 Excel */
async function exportData(merchantId, filters) {
  const excelHelper = require('../../shared/utils/excelHelper');
  const { rows } = await repo.findExcelImportBatches(merchantId, {
    ...filters, page: 1, pageSize: 10000,
  });
  const buffer = excelHelper.exportToExcelBuffer(rows);
  const fileName = `排期数据导出_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { buffer, fileName };
}

module.exports = {
  getBookedTimes, getUnavailableGrid, saveUnavailableSlots,
  downloadTemplate, importExcel, listImportBatches, getBatchDetail, exportData,
};
