/**
 * 开放日期统一工具函数
 * 创建项目、编辑项目、用户端共用同一套日期标准化逻辑
 */

/**
 * 标准化日期数组：统一为 YYYY-MM-DD 字符串数组，去重排序
 */
export function normalizeDateArray(value) {
  if (!value) return []

  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map(item => {
            if (typeof item === 'string') return item.slice(0, 10)
            if (item && typeof item === 'object') {
              const d = item.date || item.day || item.available_date || item.value || ''
              return String(d).slice(0, 10)
            }
            return ''
          })
          .filter(Boolean)
      )
    ).sort()
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return normalizeDateArray(parsed)
    } catch {
      // 兼容逗号分隔字符串
      return value
        .split(',')
        .map(item => item.trim().slice(0, 10))
        .filter(Boolean)
        .sort()
    }
  }

  return []
}

/**
 * 标准化全时段标志
 */
export function normalizeAllTimeOpen(data = {}) {
  if (!data || typeof data !== 'object') return false
  return Boolean(
    data.isAllTimeOpen ??
    data.allTime ??
    data.is_all_time_open ??
    data.all_time ??
    data.fullTime ??
    data.full_time ??
    false
  )
}

/**
 * 从 API 返回数据中提取日期配置
 */
export function normalizeOpenDateConfig(data = {}) {
  const isAllTimeOpen = normalizeAllTimeOpen(data)

  const dateSource =
    data.selectedDates ??
    data.selected_dates ??
    data.availableDates ??
    data.available_dates ??
    data.openDates ??
    data.open_dates ??
    data.serviceDates ??
    data.service_dates ??
    data.dates

  const selectedDates = isAllTimeOpen ? [] : normalizeDateArray(dateSource)

  return { isAllTimeOpen, selectedDates }
}

/**
 * 构建提交 payload 中的开放日期字段
 */
export function normalizeOpenDatePayload({ isAllTimeOpen, selectedDates }) {
  return {
    isAllTimeOpen: !!isAllTimeOpen,
    selectedDates: isAllTimeOpen ? [] : normalizeDateArray(selectedDates),
    availableDates: isAllTimeOpen ? [] : normalizeDateArray(selectedDates),
  }
}
