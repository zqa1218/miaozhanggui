/**
 * 附加项目统一工具函数
 * 预设、新建项目、编辑项目、用户端共用同一套逻辑
 */

export const EXTRA_ITEM_UNIT_OPTIONS = [
  { label: '元/次', value: 'per_time' },
  { label: '元/张', value: 'per_photo' },
  { label: '元/个', value: 'per_item' },
]

export const EXTRA_ITEM_UNIT_LABEL_MAP = {
  per_time: '元/次',
  per_photo: '元/张',
  per_item: '元/个',
  '元/次': '元/次',
  '元/张': '元/张',
  '元/个': '元/个',
}

export function normalizeUnit(unit) {
  if (unit === '元/次') return 'per_time'
  if (unit === '元/张') return 'per_photo'
  if (unit === '元/个') return 'per_item'
  if (unit === 'per_session') return 'per_time'
  return unit || 'per_time'
}

export function getExtraUnitLabel(unit) {
  return EXTRA_ITEM_UNIT_LABEL_MAP[unit] || '元/次'
}

/**
 * 从任意来源提取附加项目列表
 * 支持对象属性读取和直接数组传入
 * 修复: [] 在 JS 中为 truthy，导致 || 链在空数组处短路，改用显式检查
 */
export function normalizeExtraItems(source) {
  if (!source) return []
  if (Array.isArray(source)) return normalizeItems(source)
  if (typeof source !== 'object') return []

  // 按优先级尝试各字段，跳过空数组（[] 在 JS 中是 truthy！）
  const candidates = [
    source.extraItems,
    source.additionalItems,
    source.extra_items,
    source.additional_items,
    source.extra_items_json,
    source.pricingExtraItems,
    source.pricing_extra_items,
  ]

  for (const raw of candidates) {
    if (raw === undefined || raw === null) continue
    if (Array.isArray(raw) && raw.length === 0) continue
    if (Array.isArray(raw)) return normalizeItems(raw)
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return normalizeItems(parsed)
      } catch { /* skip */ }
    }
  }

  return []
}

function normalizeItems(list) {
  return list
    .filter(Boolean)
    .map(item => ({
      id: item.id || item._id || undefined,
      name: item.name || item.title || '',
      price: Number(item.price || item.amount || 0),
      unit: normalizeUnit(item.unit || item.unitType || item.unit_type),
    }))
    .filter(item => item.name)
}

/**
 * 提交时清洗：去空、trim、标准化 unit
 */
export function normalizeExtraItemsForSubmit(items) {
  if (!Array.isArray(items)) return []
  return items
    .filter(item => item && typeof item.name === 'string' && item.name.trim())
    .map(item => ({
      id: item.id || item._id || undefined,
      name: item.name.trim(),
      price: Number(item.price || 0),
      unit: normalizeUnit(item.unit || 'per_time'),
    }))
}

export function getExtraItemKey(item, index) {
  return String(
    item.id ||
    item._id ||
    item.key ||
    `${item.name || 'extra'}_${item.price || 0}_${item.unit || 'per_time'}_${index}`
  )
}

/**
 * 计算单项附加金额
 * @param {object} item  附加项目 { price, unit }
 * @param {object} ctx   上下文 { photoCount }
 */
export function getExtraItemAmount(item, ctx = {}) {
  const price = Number(item.price || 0)
  const unit = normalizeUnit(item.unit)
  if (unit === 'per_photo') {
    const count = Number(ctx.photoCount || 1)
    return price * count
  }
  return price
}

export function getExtraItemsTotal(items, ctx = {}) {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => sum + getExtraItemAmount(item, ctx), 0)
}

export function formatMoney(val) {
  const n = Number(val)
  if (Number.isNaN(n)) return '0'
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}
