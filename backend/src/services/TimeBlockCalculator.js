/**
 * 高精度排期精算器
 *
 * calculateOrderTimeBlock() 是系统唯一的排期计算入口。
 * 输入服务类型、数量、新人标识、起始时间点，
 * 依据项目主表中的耗时规则与间隔休息，精算出闭合的连续时间段 [startTime, endTime]。
 */

/**
 * @typedef {Object} TimeBlockParams
 * @property {'single'|'package'} pricing_type - 服务类型
 * @property {number} quantity - 数量（single 时表示张数，package 时表示套餐数）
 * @property {boolean} is_new_customer - 是否新人
 * @property {string} start_time - 起始时间点 "HH:mm"
 * @property {Object} studio - 项目主表记录（含耗时规则字段）
 *
 * @typedef {Object} TimeBlockResult
 * @property {string} start_time - 开始时间 "HH:mm"
 * @property {string} end_time   - 结束时间 "HH:mm"
 * @property {number} total_minutes - 总耗时（分钟）
 * @property {number} session_count - 实际次数
 * @property {Object[]} segments - 每段时间段明细 [{start, end, type: 'shoot'|'rest'}]
 */

function calculateOrderTimeBlock({ pricing_type, quantity, is_new_customer, start_time, studio }) {
  // ---- 1. 提取项目耗时规则 ----
  const singleDuration    = studio.single_duration_minutes        || 60;
  const sessionDuration   = studio.package_session_duration_minutes || 60;
  const restInterval      = studio.rest_interval_minutes          || 0;
  const newCustomerExtra  = studio.new_customer_extra_minutes     || 0;

  let sessionCount;
  let durationPerSession;

  if (pricing_type === 'single') {
    // 单张模式: quantity = 张数，每张耗时 = singleDuration
    sessionCount = quantity;
    durationPerSession = singleDuration;
  } else {
    // 套餐模式: quantity = 套餐数量，每套包含 package_session_count 次
    sessionCount = quantity * (studio.package_session_count || 1);
    durationPerSession = sessionDuration;
  }

  // ---- 2. 计算总耗时（分钟）----
  // 公式: 总耗时 = sessionCount * durationPerSession + (sessionCount - 1) * restInterval + 新人加成
  const shootMinutes     = sessionCount * durationPerSession;
  const restMinutes      = Math.max(0, sessionCount - 1) * restInterval;
  const newCustomerExtraTotal = is_new_customer ? newCustomerExtra : 0;
  const totalMinutes     = shootMinutes + restMinutes + newCustomerExtraTotal;

  // ---- 3. 计算闭合时间段 [startTime, endTime] ----
  const startParts = start_time.split(':');
  const startTotalMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
  const endTotalMinutes   = startTotalMinutes + totalMinutes;

  const endHours   = Math.floor(endTotalMinutes / 60) % 24;
  const endMinutes = endTotalMinutes % 60;

  const end_time = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

  // ---- 4. 构建每段时间段明细（供调试/展示）----
  const segments = [];
  let cursor = startTotalMinutes;

  for (let i = 0; i < sessionCount; i++) {
    // 新人首张额外时间
    if (i === 0 && is_new_customer && newCustomerExtra > 0) {
      const extraStart = toTimeStr(cursor);
      cursor += newCustomerExtra;
      segments.push({ start: extraStart, end: toTimeStr(cursor), type: 'new_customer_extra' });
    }

    const segStart = cursor;
    cursor += durationPerSession;
    segments.push({ start: toTimeStr(segStart), end: toTimeStr(cursor), type: 'shoot' });

    // 间隔休息（最后一次不添加）
    if (i < sessionCount - 1 && restInterval > 0) {
      const restStart = cursor;
      cursor += restInterval;
      segments.push({ start: toTimeStr(restStart), end: toTimeStr(cursor), type: 'rest' });
    }
  }

  return {
    start_time,
    end_time,
    total_minutes: totalMinutes,
    session_count: sessionCount,
    segments,
  };
}

function toTimeStr(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

module.exports = { calculateOrderTimeBlock };
