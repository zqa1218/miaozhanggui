/**
 *   日期工具函数
 */

/** 格式化 Date → 'YYYY-MM-DD' */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 获取某月的天数 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** 获取某月第1天是周几 (0=周日) */
function getFirstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

/** 生成指定分钟间隔的时间槽列表 */
function generateTimeSlots(openTime, closeTime, intervalMinutes) {
  const slots = [];
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  const start = oh * 60 + om;
  const end = ch * 60 + cm;

  for (let t = start; t < end; t += intervalMinutes) {
    const hh = String(Math.floor(t / 60)).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

/** 生成半小时粒度的时间槽（用于不可接单网格） */
function generateHalfHourSlots(openTime, closeTime) {
  return generateTimeSlots(openTime, closeTime, 30);
}

/** 判断日期是否不晚于今天 */
function isBeforeToday(dateStr) {
  const today = formatDate(new Date());
  return dateStr <= today;
}

module.exports = {
  formatDate,
  getDaysInMonth,
  getFirstDayOfWeek,
  generateTimeSlots,
  generateHalfHourSlots,
  isBeforeToday,
};
