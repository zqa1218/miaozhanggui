const path = require('path');
const ERROR_CODES = require('../../shared/errors/errorCodes');
const AppError = require('../../shared/errors/AppError');
const knex = require('../../shared/database/knex');
const storage = require('../../shared/storage');
const repo = require('./studio.repository');
const styleRepo = require('../style/style.repository');

/** 客户端-精简列表 — 批量化所有子查询，消除 N+1 */
async function getLiteList(mId) {
  const rows = await repo.findAllByMerchant(mId);
  if (rows.length === 0) return [];

  const studioIds = rows.map(r => r.id);

  // 一次并行加载所有子数据
  const [availDates, styleRelations, styleDataList, allPackages, allAddons] = await Promise.all([
    knex('studio_availabilities')
      .whereIn('studio_id', studioIds)
      .select('studio_id', knex.raw('CAST(available_date AS CHAR) as available_date'))
      .orderBy('available_date', 'asc'),
    knex('studio_style_relations').whereIn('studio_id', studioIds).select('studio_id', 'style_id'),
    knex('studio_style_relations as ssr')
      .join('styles', 'styles.id', 'ssr.style_id')
      .whereIn('ssr.studio_id', studioIds)
      .select('ssr.studio_id', 'styles.id', 'styles.style_name', 'styles.style_cover_url',
        'styles.single_price', 'styles.has_package', 'styles.package_price'),
    knex('style_packages')
      .whereIn('style_id', function () {
        this.select('style_id').from('studio_style_relations').whereIn('studio_id', studioIds);
      })
      .orderBy('photo_count', 'asc'),
    knex('style_additional_items')
      .whereIn('style_id', function () {
        this.select('style_id').from('studio_style_relations').whereIn('studio_id', studioIds);
      })
      .orderBy('id', 'asc'),
  ]);

  // 构建索引 map
  const availByStudio = {}; for (const d of availDates) { (availByStudio[d.studio_id] ||= []).push(d.available_date); }
  const stylesByStudio = {}; for (const s of styleDataList) { (stylesByStudio[s.studio_id] ||= []).push(s); }
  const relsByStudio = {};   for (const r of styleRelations) { (relsByStudio[r.studio_id] ||= []).push(r.style_id); }
  const pkgsByStyle = {};    for (const p of allPackages) {
    (pkgsByStyle[p.style_id] ||= []).push({ id: p.id, name: p.name, photoCount: p.photo_count, totalPrice: Number(p.total_price), fixedDuration: p.fixed_duration, description: p.description || '' });
  }
  const addonsByStyle = {};  for (const a of allAddons) {
    (addonsByStyle[a.style_id] ||= []).push({ id: a.id, name: a.name, price: Number(a.price), unit: a.unit, negotiable: !!(a.negotiable || false), priceRangeMin: Number(a.price_range_min || 0), priceRangeMax: Number(a.price_range_max || 0) });
  }

  return rows.map(row => mapToLiteDTOFromCache(row, { availByStudio, stylesByStudio, relsByStudio, pkgsByStyle, addonsByStyle }));
}

/** 纯函数 DTO 映射——从预取缓存中取数据，无 DB 调用 */
function mapToLiteDTOFromCache(row, cache) {
  const dto = {
    id: row.id, title: row.title, description: row.description, coverUrl: row.cover_url, city: row.city,
    isStyleEnabled: row.is_style_enabled, isAllTimeOpen: row.is_all_time_open,
    is_deleted: !!row.is_deleted,
    sort_order: row.sort_order || 0,
    created_at: row.created_at,
    addressRequired: row.address_required || false,
    singlePrice: row.single_price, hasPackage: row.has_package, packagePrice: row.package_price,
    baseStartTime: fmtTime(row.base_start_time), baseEndTime: fmtTime(row.base_end_time),
    intervalRestTime: row.interval_rest_time, isExperienceEnabled: row.is_experience_enabled,
    noviceSingleAddTime: row.novice_single_add_time, novicePackageAddTime: row.novice_package_add_time,
    singleShotTime: row.single_shot_time, packageTime: row.package_time,
    packageSessionCount: row.package_session_count || 1, depositRatio: row.deposit_ratio,
    extraItems: safeJson(row.extra_items, []), detailImgUrls: safeJson(row.detail_img_urls, []),
    serviceMode: row.service_mode, calcMode: row.calc_mode,
    openTime: fmtTime(row.open_time), closeTime: fmtTime(row.close_time),
    timeInterval: row.time_interval, minPhotos: row.min_photos,
    extraPersonFee: row.extra_person_fee, customRemarkLabel: row.custom_remark_label,
    availableDates: cache.availByStudio[row.id] || [],
  };

  if (row.is_style_enabled) {
    const styles = cache.stylesByStudio[row.id] || [];
    dto.styles = styles.map(s => ({
      id: s.id, styleName: s.style_name, styleCoverUrl: s.style_cover_url,
      singlePrice: Number(s.single_price), hasPackage: s.has_package,
      packagePrice: s.package_price ? Number(s.package_price) : null,
      packages: cache.pkgsByStyle[s.id] || [],
      additionalItems: cache.addonsByStyle[s.id] || [],
    }));
    dto.selectedStyleIds = (cache.relsByStudio[row.id] || []).slice();
  } else {
    dto.styles = [];
    dto.selectedStyleIds = [];
  }

  return dto;
}

/** 客户端/管理端-完整列表 */
async function getFullList(mId) {
  const rows = await repo.findAllByMerchant(mId);
  return Promise.all(rows.map(mapToFullDTO));
}

/** 校验工作时间合法性 */
function validateTimeRange(start, end) {
  if (start && end && start >= end) {
    throw new AppError(ERROR_CODES.PARAM_TIME_INVALID, 400, '工作起始时间必须早于结束时间');
  }
}

/** 创建项目 (事务: studios + style_relations + availabilities + rest_slots) */
async function create(data) {
  validateTimeRange(data.baseStartTime, data.baseEndTime);

  // 如果启用样式，校验所选样式属于该商户
  if (data.isStyleEnabled && data.selectedStyleIds && data.selectedStyleIds.length > 0) {
    const validStyles = await styleRepo.findByIds(data.selectedStyleIds, data.mId);
    if (validStyles.length !== data.selectedStyleIds.length) {
      throw new AppError(ERROR_CODES.STYLE_NOT_FOUND, 400, '部分所选样式不存在');
    }
  }

  const studioPayload = {
    m_id: data.mId,
    title: data.title,
    city: data.city || '',
    description: data.description || '',
    cover_url: data.coverUrl || '',
    detail_img_urls: JSON.stringify(data.detailImgUrls || []),
    is_style_enabled: data.isStyleEnabled || false,
    is_all_time_open: data.isAllTimeOpen || false,
    address_required: data.addressRequired || false,
    single_price: data.isStyleEnabled ? null : (data.pricingModel === 'package' ? null : (data.singlePrice ?? null)),
    has_package: !data.isStyleEnabled && (data.pricingModel === 'package' || data.pricingModel === 'both'),
    package_price: !data.isStyleEnabled && (data.pricingModel === 'package' || data.pricingModel === 'both') ? data.packagePrice : null,
    base_start_time: data.baseStartTime,
    base_end_time: data.baseEndTime,
    interval_rest_time: data.intervalRestTime || 0,
    is_experience_enabled: data.isExperienceEnabled || false,
    novice_single_add_time: data.noviceSingleAddTime || 0,
    novice_package_add_time: data.novicePackageAddTime || 0,
    single_shot_time: data.singleShotTime,
    package_time: data.packageTime || null,
    package_session_count: data.packageSessionCount || 1,
    deposit_ratio: data.depositRatio || 30,
    extra_items: JSON.stringify(data.extraItems || []),
    // 保留旧字段兼容
    service_mode: 'studio',
    calc_mode: 'time',
    open_time: data.baseStartTime || '09:00',
    close_time: data.baseEndTime || '21:00',
    time_interval: 60,
  };

  return knex.transaction(async (trx) => {
    const [insertId] = await knex('studios').transacting(trx).insert(studioPayload);

    // 样式关联
    if (data.isStyleEnabled && data.selectedStyleIds && data.selectedStyleIds.length > 0) {
      const relations = data.selectedStyleIds.map(sid => ({
        studio_id: insertId,
        style_id: sid,
      }));
      await repo.insertStyleRelations(trx, relations);
    }

    // 可选日期
    await repo.replaceAvailabilities(trx, insertId, data.availableDates || []);

    // 休息时段
    await repo.replaceRestSlots(trx, insertId, data.restSlots || []);

    return { success: true, id: insertId };
  });
}

/** 编辑项目 */
async function update(data) {
  if (data.baseStartTime && data.baseEndTime) {
    validateTimeRange(data.baseStartTime, data.baseEndTime);
  }

  const existing = await repo.findByIdAndMerchant(data.id, data.mId);
  if (!existing) throw new AppError(ERROR_CODES.STUDIO_NOT_FOUND, 404);

  const payload = {};

  // 基础字段映射
  const fieldMap = {
    title: 'title', city: 'city',
    description: 'description', coverUrl: 'cover_url',
    isStyleEnabled: 'is_style_enabled', hasPackage: 'has_package',
    isAllTimeOpen: 'is_all_time_open',
    addressRequired: 'address_required',
    baseStartTime: 'base_start_time', baseEndTime: 'base_end_time',
    intervalRestTime: 'interval_rest_time',
    isExperienceEnabled: 'is_experience_enabled',
    noviceSingleAddTime: 'novice_single_add_time',
    novicePackageAddTime: 'novice_package_add_time',
    singleShotTime: 'single_shot_time', packageTime: 'package_time',
    packageSessionCount: 'package_session_count',
    depositRatio: 'deposit_ratio',
  };

  for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
    if (data[jsKey] !== undefined && data[jsKey] !== null) payload[dbKey] = data[jsKey];
  }

  // 计价字段
  if (data.isStyleEnabled !== undefined) {
    if (data.isStyleEnabled) {
      payload.single_price = null;
      payload.package_price = null;
    }
  }
  if (data.pricingModel !== undefined) {
    if (data.pricingModel === 'package') {
      payload.single_price = null;
    }
    payload.has_package = (data.pricingModel === 'package' || data.pricingModel === 'both');
  }
  // pricingModel === 'package' 时 singlePrice 不覆盖 null，保证仅套餐不残留单张价格
  if (data.singlePrice !== undefined && data.pricingModel !== 'package') {
    payload.single_price = data.singlePrice;
  }
  if (data.packagePrice !== undefined) payload.package_price = data.packagePrice;

  if (data.detailImgUrls !== undefined) payload.detail_img_urls = JSON.stringify(data.detailImgUrls);
  if (data.extraItems !== undefined) payload.extra_items = JSON.stringify(data.extraItems);

  // 同步旧字段
  if (data.baseStartTime) { payload.open_time = data.baseStartTime; }
  if (data.baseEndTime) { payload.close_time = data.baseEndTime; }

  return knex.transaction(async (trx) => {
    if (Object.keys(payload).length > 0) {
      await knex('studios').transacting(trx).where({ id: data.id, m_id: data.mId })
        .update({ ...payload, updated_at: knex.fn.now() });
    }

    // 更新样式关联
    if (data.selectedStyleIds !== undefined) {
      await repo.deleteStyleRelations(trx, data.id);
      if (data.selectedStyleIds.length > 0) {
        const relations = data.selectedStyleIds.map(sid => ({
          studio_id: data.id,
          style_id: sid,
        }));
        await repo.insertStyleRelations(trx, relations);
      }
    }

    // 更新可选日期
    if (data.isAllTimeOpen !== undefined) {
      // 全时段：清空可选日期
      if (data.isAllTimeOpen) {
        await repo.replaceAvailabilities(trx, data.id, []);
      }
    }
    if (data.availableDates !== undefined) {
      await repo.replaceAvailabilities(trx, data.id, data.availableDates);
    }

    // 更新休息时段
    if (data.restSlots !== undefined) {
      await repo.replaceRestSlots(trx, data.id, data.restSlots);
    }

    return { success: true };
  });
}

/** 删除项目 */
async function remove(id, mId) {
  const existing = await repo.findByIdAndMerchant(id, mId);
  if (!existing) throw new AppError(ERROR_CODES.STUDIO_NOT_FOUND, 404);
  await repo.softDelete(id, mId);
  return { success: true };
}

/** 更新项目排序 */
async function updateStudioOrder(mId, orderedList) {
  const studioIds = orderedList.map(item => item.id);
  const studios = await repo.findByIds(studioIds);

  const unauthorized = studios.find(s => s.m_id !== mId);
  if (unauthorized) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);

  await repo.batchUpdateSortOrder(orderedList);
  return { reordered: orderedList.length };
}

/** 删除项目图片 */
async function removeStudioImage(mId, studioId, imageUrl, imageType) {
  const studio = await repo.findById(studioId);
  if (!studio || studio.m_id !== mId) throw new AppError(ERROR_CODES.UNAUTHORIZED, 403);

  const filename = path.basename(imageUrl);
  const subDir = imageType === 'cover' ? 'covers' : 'details';
  storage.deleteFile(`/uploads/${subDir}/${filename}`);

  await repo.removeStudioImage(studioId, imageUrl, imageType);
}

// ─── DTO 映射 ───

async function mapToLiteDTO(row) {
  const dto = {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    city: row.city,
    isStyleEnabled: row.is_style_enabled,
    isAllTimeOpen: row.is_all_time_open,
    is_deleted: !!row.is_deleted,
    sort_order: row.sort_order || 0,
    created_at: row.created_at,
    addressRequired: row.address_required || false,
    singlePrice: row.single_price,
    hasPackage: row.has_package,
    packagePrice: row.package_price,
    baseStartTime: fmtTime(row.base_start_time),
    baseEndTime: fmtTime(row.base_end_time),
    intervalRestTime: row.interval_rest_time,
    isExperienceEnabled: row.is_experience_enabled,
    noviceSingleAddTime: row.novice_single_add_time,
    novicePackageAddTime: row.novice_package_add_time,
    singleShotTime: row.single_shot_time,
    packageTime: row.package_time,
    packageSessionCount: row.package_session_count || 1,
    depositRatio: row.deposit_ratio,
    extraItems: safeJson(row.extra_items, []),
    detailImgUrls: safeJson(row.detail_img_urls, []),
    // 兼容旧字段
    serviceMode: row.service_mode,
    calcMode: row.calc_mode,
    openTime: fmtTime(row.open_time),
    closeTime: fmtTime(row.close_time),
    timeInterval: row.time_interval,
    minPhotos: row.min_photos,
    extraPersonFee: row.extra_person_fee,
    customRemarkLabel: row.custom_remark_label,
  };

  // 附件：可选日期（用于客户端限制日期选择范围）
  const availDates = await knex('studio_availabilities')
    .where('studio_id', row.id)
    .select(knex.raw('CAST(available_date AS CHAR) as available_date'))
    .orderBy('available_date', 'asc');
  dto.availableDates = availDates.map(r => r.available_date);

  // 若启用样式，附带关联的样式列表 + 已选样式 ID + 各样式套餐
  if (row.is_style_enabled) {
    const [styles, rels] = await Promise.all([
      knex('studio_style_relations as ssr')
        .join('styles', 'styles.id', 'ssr.style_id')
        .where('ssr.studio_id', row.id)
        .select('styles.id', 'styles.style_name', 'styles.style_cover_url',
          'styles.single_price', 'styles.has_package', 'styles.package_price'),
      knex('studio_style_relations').where('studio_id', row.id).select('style_id'),
    ]);
    // 批量加载所有关联样式的套餐 + 附加项目
    const styleIds = styles.map(s => s.id);
    const [allPackages, allAddons] = styleIds.length > 0
      ? await Promise.all([
          knex('style_packages').whereIn('style_id', styleIds).orderBy('photo_count', 'asc'),
          knex('style_additional_items').whereIn('style_id', styleIds).orderBy('id', 'asc'),
        ])
      : [[], []];
    const packagesByStyle = {};
    for (const p of allPackages) {
      if (!packagesByStyle[p.style_id]) packagesByStyle[p.style_id] = [];
      packagesByStyle[p.style_id].push({
        id: p.id,
        name: p.name,
        photoCount: p.photo_count,
        totalPrice: Number(p.total_price),
        fixedDuration: p.fixed_duration,
        description: p.description || '',
      });
    }
    const addonsByStyle = {};
    for (const a of allAddons) {
      if (!addonsByStyle[a.style_id]) addonsByStyle[a.style_id] = [];
      addonsByStyle[a.style_id].push({
        id: a.id,
        name: a.name,
        price: Number(a.price),
        unit: a.unit,
        negotiable: !!(a.negotiable || false),
        priceRangeMin: Number(a.price_range_min || 0),
        priceRangeMax: Number(a.price_range_max || 0),
      });
    }

    dto.styles = styles.map(s => ({
      id: s.id,
      styleName: s.style_name,
      styleCoverUrl: s.style_cover_url,
      singlePrice: Number(s.single_price),
      hasPackage: s.has_package,
      packagePrice: s.package_price ? Number(s.package_price) : null,
      packages: packagesByStyle[s.id] || [],
      additionalItems: addonsByStyle[s.id] || [],
    }));
        dto.selectedStyleIds = rels.map(r => r.style_id);
  } else {
    dto.styles = [];
    dto.selectedStyleIds = [];
  }

  return dto;
}

async function mapToFullDTO(row) {
  const dto = await mapToLiteDTO(row);
  dto.availableDates = (await repo.findAvailabilities(row.id)).map(r => r.available_date);
  dto.restSlots = (await repo.findRestSlots(row.id)).map(r => ({
    start_time: fmtTime(r.start_time),
    end_time: fmtTime(r.end_time),
  }));
  if (dto.isStyleEnabled) {
    const rels = await knex('studio_style_relations').where('studio_id', row.id).select('style_id');
    dto.selectedStyleIds = rels.map(r => r.style_id);
  }
  return dto;
}

function safeJson(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function fmtTime(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 5);
  return v;
}

module.exports = { getLiteList, getFullList, create, update, remove, updateStudioOrder, removeStudioImage };
