const knex = require('../../shared/database/knex');

const TABLE = 'studios';

function findAllByMerchant(mId, includeDeleted = false) {
  let query = knex(TABLE).where('m_id', mId);
  if (!includeDeleted) query = query.where('is_deleted', false);
  return query
    .orderByRaw('CASE WHEN sort_order IS NULL OR sort_order = 0 THEN 1 ELSE 0 END')
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'desc');
}

function findByIds(ids) {
  return knex(TABLE).whereIn('id', ids);
}

/** 批量更新项目排序，事务保证原子性 */
async function batchUpdateSortOrder(orderedList) {
  const trx = await knex.transaction();
  try {
    for (const item of orderedList) {
      await trx(TABLE).where({ id: item.id }).update({ sort_order: item.sort_order, updated_at: knex.fn.now() });
    }
    await trx.commit();
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

/** 安全解析 JSON 字段 */
function safeJsonParse(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string' && !val.startsWith('[') && !val.startsWith('{')) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

/** 删除项目单张图片（封面或详情图） */
async function removeStudioImage(studioId, imageUrl, imageType) {
  const studio = await knex(TABLE).where({ id: studioId }).first();
  if (!studio) return null;

  if (imageType === 'cover') {
    return knex(TABLE).where({ id: studioId }).update({ cover_url: null, updated_at: knex.fn.now() });
  } else {
    const detailImages = safeJsonParse(studio.detail_img_urls, []);
    const updated = detailImages.filter(url => url !== imageUrl);
    return knex(TABLE).where({ id: studioId }).update({
      detail_img_urls: JSON.stringify(updated),
      updated_at: knex.fn.now(),
    });
  }
}

function findById(id) {
  return knex(TABLE).where('id', id).first();
}

function findByIdAndMerchant(id, mId) {
  return knex(TABLE).where({ id, m_id: mId }).first();
}

/** 查询项目及其关联的样式 (LEFT JOIN) */
async function findWithStyles(id) {
  const studio = await knex(TABLE).where('id', id).first();
  if (!studio) return null;
  const styles = await knex('studio_style_relations as ssr')
    .join('styles', 'styles.id', 'ssr.style_id')
    .where('ssr.studio_id', id)
    .select('styles.*');
  return { ...studio, styles };
}

/** 查询项目可选日期 (返回字符串，避免 mysql2 Date 时区偏移) */
function findAvailabilities(studioId) {
  return knex('studio_availabilities')
    .where('studio_id', studioId)
    .select(knex.raw('CAST(available_date AS CHAR) as available_date'))
    .orderBy('available_date', 'asc');
}

/** 查询项目休息时段 */
function findRestSlots(studioId) {
  return knex('studio_rest_slots').where('studio_id', studioId).select('start_time', 'end_time');
}

function create(data) {
  return knex(TABLE).insert(data);
}

function update(id, mId, data) {
  return knex(TABLE).where({ id, m_id: mId }).update({ ...data, updated_at: knex.fn.now() });
}

function softDelete(id, mId) {
  return knex(TABLE).where({ id, m_id: mId }).update({ is_deleted: true, updated_at: knex.fn.now() });
}

// ─── 关联表操作 (事务内) ───

function insertStyleRelations(trx, rows) {
  if (!rows.length) return;
  return knex('studio_style_relations').transacting(trx).insert(rows);
}

function deleteStyleRelations(trx, studioId) {
  return knex('studio_style_relations').transacting(trx).where('studio_id', studioId).del();
}

function replaceAvailabilities(trx, studioId, dates) {
  return knex('studio_availabilities').transacting(trx).where('studio_id', studioId).del()
    .then(() => {
      if (dates.length > 0) {
        return knex('studio_availabilities').transacting(trx).insert(
          dates.map(d => ({ studio_id: studioId, available_date: d }))
        );
      }
    });
}

function replaceRestSlots(trx, studioId, slots) {
  return knex('studio_rest_slots').transacting(trx).where('studio_id', studioId).del()
    .then(() => {
      if (slots && slots.length > 0) {
        return knex('studio_rest_slots').transacting(trx).insert(
          slots.map(s => ({ studio_id: studioId, start_time: s.start_time, end_time: s.end_time }))
        );
      }
    });
}

module.exports = {
  findAllByMerchant, findById, findByIds, findByIdAndMerchant, findWithStyles,
  findAvailabilities, findRestSlots,
  create, update, softDelete,
  insertStyleRelations, deleteStyleRelations,
  replaceAvailabilities, replaceRestSlots,
  batchUpdateSortOrder, removeStudioImage,
};
