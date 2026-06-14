const knex = require('../../shared/database/knex');

/** 查询指定日期+项目的已占时段 */
function getBookedSlots(mId, studioId, date) {
  return knex('slot_bookings')
    .where({ m_id: mId, studio_id: studioId, booking_date: date })
    .select('time_slot', 'time_slot_end', 'is_package_day', 'booking_count', 'order_no');
}

/** 查询不可接单时段 */
function getUnavailableSlots(mId, studioId, date) {
  return knex('unavailable_slots')
    .where({ m_id: mId, studio_id: studioId, disabled_date: date })
    .select('time_slot', 'time_slot_end');
}

/** 查询某日是否有包天占用 */
function hasPackageDayBooking(mId, studioId, date) {
  return knex('slot_bookings')
    .where({ m_id: mId, studio_id: studioId, booking_date: date, is_package_day: true })
    .first();
}

/** 插入占位记录（事务中调用） */
function insertSlot(trx, data) {
  return knex('slot_bookings').transacting(trx).insert(data);
}

/** 删除占位记录 */
function deleteSlotsByOrderNo(trx, orderNo) {
  const q = knex('slot_bookings').where('order_no', orderNo);
  return trx ? q.transacting(trx).del() : q.del();
}

/** 保存不可接单时段（先删后插） */
async function replaceUnavailableSlots(trx, mId, studioId, date, slots, slotsEnd) {
  await knex('unavailable_slots').transacting(trx)
    .where({ m_id: mId, studio_id: studioId, disabled_date: date })
    .del();
  if (slots.length > 0) {
    const rows = slots.map((slot, i) => ({
      m_id: mId,
      studio_id: studioId,
      disabled_date: date,
      time_slot: slot,
      time_slot_end: slotsEnd ? slotsEnd[i] : null,
    }));
    await knex('unavailable_slots').transacting(trx).insert(rows);
  }
}

const TABLE_EXCEL_IMPORTS = 'schedule_excel_imports';

/** 批量插入 Excel 导入记录 */
async function batchInsertExcelRows(rows) {
  return knex(TABLE_EXCEL_IMPORTS).insert(rows);
}

/** 查询某商家导入批次列表（分页） */
async function findExcelImportBatches(merchantId, filters = {}) {
  const { batch_id, status, page = 1, pageSize = 20 } = filters;
  const baseQuery = knex(TABLE_EXCEL_IMPORTS)
    .where('m_id', merchantId)
    .orderBy('created_at', 'desc');
  if (batch_id) baseQuery.andWhere('batch_id', batch_id);
  if (status) baseQuery.andWhere('status', status);

  const countQuery = knex(TABLE_EXCEL_IMPORTS).where('m_id', merchantId);
  if (batch_id) countQuery.andWhere('batch_id', batch_id);
  if (status) countQuery.andWhere('status', status);

  const [{ total }] = await countQuery.count('* as total');
  const rows = await baseQuery.limit(pageSize).offset((page - 1) * pageSize);
  return { rows, total: Number(total), page, pageSize };
}

/** 按批次号查询所有导入行 */
async function findRowsByBatchId(batchId, merchantId) {
  return knex(TABLE_EXCEL_IMPORTS)
    .where('batch_id', batchId)
    .andWhere('m_id', merchantId)
    .orderBy('id', 'asc');
}

/** 批量更新导入行状态 */
async function batchUpdateStatus(ids, status, errorMessage = null) {
  const updateData = { status, updated_at: knex.fn.now() };
  if (errorMessage) updateData.error_message = errorMessage;
  return knex(TABLE_EXCEL_IMPORTS).whereIn('id', ids).update(updateData);
}

module.exports = {
  getBookedSlots, getUnavailableSlots, hasPackageDayBooking,
  insertSlot, deleteSlotsByOrderNo, replaceUnavailableSlots,
  batchInsertExcelRows, findExcelImportBatches, findRowsByBatchId, batchUpdateStatus,
};
