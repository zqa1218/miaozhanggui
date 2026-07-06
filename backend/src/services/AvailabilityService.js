const StudioAvailability = require('../models/StudioAvailability');
const StudioRestSlot = require('../models/StudioRestSlot');
const SlotBooking = require('../models/SlotBooking');
const { AppError } = require('../middleware/errorHandler');

/**
 * 可用时段服务
 * 核心逻辑: 根据开放日期 + 休息段 + 已预约时段，计算可预约的时间片
 */
const AvailabilityService = {
  /**
   * 获取某项目某日的可用时间片列表
   * @returns {Array<{start: string, end: string}>}
   */
  async getDailySlots(studioId, date) {
    const availability = await StudioAvailability.findOne(studioId, date);
    if (!availability) return []; // 该日不营业

    // 获取该日休息段
    const restSlots = await StudioRestSlot.findByStudioAndDate(studioId, date);

    // 获取已预约时段（findActiveByStudioDate 已自动排除 cancelled + 过期 pre_lock）
    const activeBookings = await SlotBooking.findActiveByStudioDate(studioId, date);

    // 从营业时间中减去休息段和已预约时段，得到可用片
    return computeAvailableSlots(
      availability.start_time,
      availability.end_time,
      restSlots,
      activeBookings
    );
  },

  /**
   * 批量设置项目开放日期
   */
  async batchSet(studioId, dates) {
    await StudioAvailability.batchUpsert(studioId, dates);
  },

  /**
   * 批量设置项目休息段
   */
  async batchSetRestSlots(studioId, slots) {
    await StudioRestSlot.batchReplace(studioId, slots);
  },
};

/**
 * 核心算法：从营业时长中减去不可用区间，得到可用时间片
 *
 * 算法简述:
 * 1. 收集所有不可用区间（休息段 + 已预约时段），按 start 排序
 * 2. 合并重叠的不可用区间
 * 3. 从营业起止时间中切出可用区间
 */
function computeAvailableSlots(openStart, openEnd, restSlots, bookings) {
  // 1. 收集不可用区间
  const blocked = [];

  for (const r of restSlots) {
    blocked.push({ start: r.start_time, end: r.end_time });
  }
  for (const b of bookings) {
    blocked.push({ start: b.start_time, end: b.end_time });
  }

  // 2. 按 start 排序
  blocked.sort((a, b) => a.start.localeCompare(b.start));

  // 3. 合并重叠区间
  const merged = [];
  for (const b of blocked) {
    if (merged.length === 0 || b.start > merged[merged.length - 1].end) {
      merged.push({ ...b });
    } else {
      const last = merged[merged.length - 1];
      if (b.end > last.end) last.end = b.end;
    }
  }

  // 4. 从营业时间中切出可用片
  const available = [];
  let cursor = openStart;

  for (const m of merged) {
    if (cursor < m.start) {
      available.push({ start: cursor, end: m.start });
    }
    if (m.end > cursor) cursor = m.end;
  }
  if (cursor < openEnd) {
    available.push({ start: cursor, end: openEnd });
  }

  return available;
}

module.exports = AvailabilityService;
