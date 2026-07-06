const AppError = require('../../shared/errors/AppError');
const ERROR_CODES = require('../../shared/errors/errorCodes');
const { generateHalfHourSlots, timeToMinutes, minutesToTime } = require('../../shared/utils/dateHelper');
const repo = require('./schedule.repository');
const studioRepo = require('../studio/studio.repository');

function computeSlotEnd(startTime, stepMinutes) {
  return minutesToTime(timeToMinutes(startTime) + stepMinutes);
}

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

  // 构建时段→结束时间的映射
  const endTimeMap = {};
  bookedRows.forEach((r) => { if (r.time_slot_end) endTimeMap[r.time_slot] = r.time_slot_end; });
  unavailableRows.forEach((r) => { if (r.time_slot_end) endTimeMap[r.time_slot] = r.time_slot_end; });

  return {
    bookedMap,
    endTimeMap,
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
  // 构建起始时间→结束时间的映射
  const endTimeMap = {};
  disabledRows.forEach((r) => { if (r.time_slot_end) endTimeMap[r.time_slot] = r.time_slot_end; });

  // 每个格段计算其结束时间（起始 + 30min）
  return allSlots.map((slot) => ({
    slot,
    slotEnd: endTimeMap[slot] || computeSlotEnd(slot, 30),
    disabled: disabledSet.has(slot),
  }));
}

/**
 *   保存不可接单时段
 */
async function saveUnavailableSlots(mId, studioId, date, slots, slotsEnd) {
  if (slotsEnd && slotsEnd.length > 0 && slotsEnd.length !== slots.length) {
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '  时段起始与结束数量不匹配  ');
  }
  const studio = await studioRepo.findByIdAndMerchant(studioId, mId);
  if (!studio) throw new AppError(ERROR_CODES.STUDIO_NOT_FOUND, 404);

  const knex = require('../../shared/database/knex');
  await knex.transaction(async (trx) => {
    await repo.replaceUnavailableSlots(trx, mId, studioId, date, slots, slotsEnd);
  });

  return { success: true };
}

// ════════════════════════════════════════
//  Excel 导入导出
// ════════════════════════════════════════
const logger = require('../../shared/logger');

async function downloadTemplate() {
  const excelHelper = require('../../shared/utils/excelHelper');
  const buffer = excelHelper.generateTemplateBuffer();
  const fileName = `排期导入模板_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { buffer, fileName };
}

async function importExcel(filePath, originalName, merchantId) {
  const excelHelper = require('../../shared/utils/excelHelper');
  const fs = require('fs');
  const { v4: uuidv4 } = require('uuid');
  const ext = require('path').extname(originalName).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) {
    fs.unlink(filePath, () => {});
    throw new AppError(ERROR_CODES.PARAM_INVALID, 400, '仅支持 .xlsx 或 .xls 格式');
  }
  let parseResult;
  try { parseResult = excelHelper.parseUploadedExcel(filePath); }
  finally { fs.unlink(filePath, () => {}); }

  const { validRows, errors, total, successCount, failCount } = parseResult;
  const batchId = `BATCH_${Date.now()}_${uuidv4().slice(0, 8)}`;
  if (validRows.length === 0) {
    return { batchId, total, successCount: 0, failCount, errors, message: '所有数据行均有错误，未导入任何数据' };
  }
  const insertRows = validRows.map((row) => ({
    batch_id: batchId, project: row.project, schedule_date: row.schedule_date,
    time_slot_start: row.time_slot_start, time_slot_end: row.time_slot_end,
    contact: row.contact, remarks: row.remarks, m_id: merchantId, status: 'pending',
  }));
  await repo.batchInsertExcelRows(insertRows);
  await autoMatchStudios(batchId, merchantId);
  return { batchId, total, successCount, failCount, errors, message: `成功导入 ${successCount} 条，失败 ${failCount} 条` };
}

async function autoMatchStudios(batchId, merchantId) {
  try {
    const rows = await repo.findRowsByBatchId(batchId, merchantId);
    if (rows.length === 0) return;
    const knex = require('../../shared/database/knex');
    const studios = await knex('studios').where('m_id', merchantId).where('is_deleted', false).select('id', 'title');
    for (const row of rows) {
      const matched = studios.find((s) => s.title.trim().toLowerCase() === row.project.trim().toLowerCase());
      if (matched) {
        await knex('schedule_excel_imports').where('id', row.id).update({ studio_id: matched.id, studio_name: matched.title });
      }
    }
  } catch (err) { logger.warn(`[ExcelImport] 自动匹配失败 batch=${batchId}`, err.message); }
}

async function listImportBatches(merchantId, filters) {
  return repo.findExcelImportBatches(merchantId, filters);
}

async function getBatchDetail(batchId, merchantId) {
  const rows = await repo.findRowsByBatchId(batchId, merchantId);
  if (rows.length === 0) throw new AppError(ERROR_CODES.ORDER_NOT_FOUND, 404, '批次不存在');
  return rows;
}

async function exportData(merchantId, filters) {
  const excelHelper = require('../../shared/utils/excelHelper');
  const { rows } = await repo.findExcelImportBatches(merchantId, { ...filters, page: 1, pageSize: 10000 });
  const buffer = excelHelper.exportToExcelBuffer(rows);
  const fileName = `排期数据导出_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { buffer, fileName };
}

module.exports = {
  getBookedTimes, getUnavailableGrid, saveUnavailableSlots,
  downloadTemplate, importExcel, listImportBatches, getBatchDetail, exportData,
};
