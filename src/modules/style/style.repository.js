const knex = require('../../shared/database/knex');

const TABLE = 'styles';

function findByMerchant(mId) {
  return knex(TABLE).where('m_id', mId).orderBy('created_at', 'desc');
}

function findByIdAndMerchant(id, mId) {
  return knex(TABLE).where({ id, m_id: mId }).first();
}

function findByIds(ids, mId) {
  return knex(TABLE).where('m_id', mId).whereIn('id', ids);
}

function create(data) {
  return knex(TABLE).insert(data);
}

function update(id, mId, data) {
  return knex(TABLE).where({ id, m_id: mId }).update({ ...data, updated_at: knex.fn.now() });
}

function remove(id, mId) {
  return knex(TABLE).where({ id, m_id: mId }).del();
}

// ─── 套餐 (style_packages) ───

function findPackagesByStyleId(styleId) {
  return knex('style_packages').where('style_id', styleId).orderBy('photo_count', 'asc');
}

function replacePackages(trx, styleId, packages) {
  return knex('style_packages').transacting(trx).where('style_id', styleId).del()
    .then(() => {
      if (packages && packages.length > 0) {
        return knex('style_packages').transacting(trx).insert(
          packages.map(p => ({
            style_id: styleId,
            name: p.name,
            photo_count: p.photoCount,
            total_price: p.totalPrice,
            fixed_duration: p.fixedDuration,
            description: p.description || '',
          }))
        );
      }
    });
}

// ─── 附加项目 (style_additional_items) ───

function findAdditionalItemsByStyleId(styleId) {
  return knex('style_additional_items').where('style_id', styleId).orderBy('id', 'asc');
}

function replaceAdditionalItems(trx, styleId, items) {
  return knex('style_additional_items').transacting(trx).where('style_id', styleId).del()
    .then(() => {
      if (items && items.length > 0) {
        return knex('style_additional_items').transacting(trx).insert(
          items.map(item => ({
            style_id: styleId,
            name: item.name,
            price: item.price,
            unit: item.unit || 'per_session',
          }))
        );
      }
    });
}

module.exports = {
  findByMerchant, findByIdAndMerchant, findByIds, create, update, remove,
  findPackagesByStyleId, replacePackages,
  findAdditionalItemsByStyleId, replaceAdditionalItems,
};
