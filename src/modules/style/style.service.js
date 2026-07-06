const ERROR_CODES = require('../../shared/errors/errorCodes');
const AppError = require('../../shared/errors/AppError');
const knex = require('../../shared/database/knex');
const repo = require('./style.repository');

async function getList(mId) {
  const rows = await repo.findByMerchant(mId);
  return Promise.all(rows.map(mapDTO));
}

async function create(data) {
  const packages = data.packages || [];
  const additionalItems = data.additionalItems || [];

  return knex.transaction(async (trx) => {
    const [styleId] = await knex('styles').transacting(trx).insert({
      m_id: data.mId,
      style_name: data.styleName,
      style_cover_url: data.styleCoverUrl || '',
      single_price: data.singlePrice,
      has_package: packages.length > 0,
      package_price: packages.length > 0 ? packages[0].totalPrice : null,
    });

    if (packages.length > 0) {
      await repo.replacePackages(trx, styleId, packages);
    }
    if (additionalItems.length > 0) {
      await repo.replaceAdditionalItems(trx, styleId, additionalItems);
    }

    return { success: true, id: styleId };
  });
}

async function update(data) {
  const existing = await repo.findByIdAndMerchant(data.id, data.mId);
  if (!existing) throw new AppError(ERROR_CODES.STYLE_NOT_FOUND, 404);

  return knex.transaction(async (trx) => {
    const payload = {};
    if (data.styleName !== undefined) payload.style_name = data.styleName;
    if (data.styleCoverUrl !== undefined) payload.style_cover_url = data.styleCoverUrl;
    if (data.singlePrice !== undefined) payload.single_price = data.singlePrice;

    // packages: 明确传入时替换
    if (data.packages !== undefined) {
      await repo.replacePackages(trx, data.id, data.packages);
      payload.has_package = data.packages.length > 0;
      payload.package_price = data.packages.length > 0 ? data.packages[0].totalPrice : null;
    }
    // additionalItems: 明确传入时替换
    if (data.additionalItems !== undefined) {
      await repo.replaceAdditionalItems(trx, data.id, data.additionalItems);
    }

    if (Object.keys(payload).length > 0) {
      await knex('styles').transacting(trx).where({ id: data.id, m_id: data.mId })
        .update({ ...payload, updated_at: knex.fn.now() });
    }

    return { success: true };
  });
}

async function remove(id, mId) {
  const existing = await repo.findByIdAndMerchant(id, mId);
  if (!existing) throw new AppError(ERROR_CODES.STYLE_NOT_FOUND, 404);
  // CASCADE 自动删除关联的 style_packages
  await repo.remove(id, mId);
  return { success: true };
}

async function mapDTO(row) {
  const [packages, additionalItems] = await Promise.all([
    repo.findPackagesByStyleId(row.id),
    repo.findAdditionalItemsByStyleId(row.id),
  ]);
  return {
    id: row.id,
    mId: row.m_id,
    styleName: row.style_name,
    styleCoverUrl: row.style_cover_url,
    singlePrice: row.single_price,
    hasPackage: packages.length > 0,
    packagePrice: packages.length > 0 ? packages[0].totalPrice : null,
    packages: packages.map(p => ({
      id: p.id,
      name: p.name,
      photoCount: p.photo_count,
      totalPrice: Number(p.total_price),
      fixedDuration: p.fixed_duration,
      description: p.description || '',
    })),
    additionalItems: additionalItems.map(a => ({
      id: a.id,
      name: a.name,
      price: Number(a.price),
      unit: a.unit,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { getList, create, update, remove };
