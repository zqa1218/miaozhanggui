/**
 * =============================================
 *    价格计算引擎 —— 纯函数，零副作用
 * =============================================
 */

/**
 * @typedef {Object} StudioConfig
 * @property {string}  calcMode           - time | photo | photo_time
 * @property {number}  price              - 统一价格
 * @property {number}  weekdayPrice       - 工作日价格
 * @property {number}  holidayPrice       - 节假日价格
 * @property {boolean} isHolidayPrice     - 是否节假日不同价
 * @property {boolean} isPackageDay       - 是否支持包天
 * @property {number}  packagePrice       - 包天价格
 * @property {boolean} hasDiscount        - 是否开启多时段折扣
 * @property {Array}   discountRules      - [{hours, price}]
 * @property {number}  depositRatio       - 定金比例
 * @property {number}  extraPersonFee     - 额外每人费用
 * @property {number}  slotMaxPhotos      - 每时段最大张数
 */

/**
 * @typedef {Object} PriceInput
 * @property {StudioConfig} studio
 * @property {string}       selectedDate
 * @property {string[]}     selectedTimes
 * @property {number}       peopleCount
 * @property {number}       photoCount
 * @property {boolean}      isPackageDaySelected
 * @property {Object}       holidayCache            - 节假日缓存 {dateStr: {isHoliday, tag}}
 */

/**
 * @typedef {Object} PriceOutput
 * @property {number}  unitPrice       - 单价
 * @property {number}  basePrice       - 基础价格
 * @property {number}  extraPersonFee  - 额外人数费
 * @property {number}  totalPrice      - 总价
 * @property {number}  depositAmount   - 定金金额
 * @property {number}  depositRatio    - 定金比例
 * @property {number}  hours           - 时长
 */

/**
 *   计算价格
 * @param {PriceInput} input
 * @returns {PriceOutput}
 */
function calculate(input) {
  const { studio, selectedTimes, peopleCount, photoCount, isPackageDaySelected, holidayCache, selectedDate } = input;
  const hours = selectedTimes.length;
  let unitPrice = studio.price || 0;
  let basePrice = 0;

  // ─── 1. 包天模式 ───
  if (studio.isPackageDay && isPackageDaySelected) {
    unitPrice = studio.packagePrice || 0;
    basePrice = unitPrice;
  }
  // ─── 2. 按张数计费 ───
  else if (studio.calcMode === 'photo') {
    unitPrice = getEffectivePrice(studio, selectedDate, holidayCache);
    basePrice = (photoCount || studio.minPhotos) * unitPrice;
  }
  // ─── 3. 按张数+时段 ───
  else if (studio.calcMode === 'photo_time') {
    unitPrice = getEffectivePrice(studio, selectedDate, holidayCache);
    basePrice = (photoCount || studio.minPhotos) * unitPrice;
  }
  // ─── 4. 按时段计费（默认） ───
  else {
    unitPrice = getEffectivePrice(studio, selectedDate, holidayCache);

    // 多时段折扣
    if (studio.hasDiscount && Array.isArray(studio.discountRules) && studio.discountRules.length > 0) {
      // 按 hours 从大到小排序，匹配第一个满足条件的折扣
      const sorted = [...studio.discountRules].sort((a, b) => b.hours - a.hours);
      const match = sorted.find((rule) => hours >= rule.hours);
      if (match) {
        unitPrice = match.price;
      }
    }
    basePrice = hours * unitPrice;
  }

  // ─── 5. 额外人数费 ───
  const extraPersons = Math.max(0, peopleCount - 1);
  const extraTotal = extraPersons * (studio.extraPersonFee || 0) * (studio.calcMode === 'photo' ? (photoCount || 1) : hours || 1);

  // ─── 6. 总价 & 定金 ───
  const totalPrice = Math.round((basePrice + extraTotal) * 100) / 100;
  const depositRatio = studio.depositRatio || 30;
  const depositAmount = Math.round((totalPrice * depositRatio / 100) * 100) / 100;

  return {
    unitPrice: Math.round(unitPrice * 100) / 100,
    basePrice: Math.round(basePrice * 100) / 100,
    extraPersonFee: Math.round(extraTotal * 100) / 100,
    totalPrice,
    depositAmount,
    depositRatio,
    hours,
  };
}

/**
 *   根据节假日缓存返回有效单价
 */
function getEffectivePrice(studio, dateStr, holidayCache) {
  if (studio.isHolidayPrice && holidayCache && holidayCache[dateStr]?.isHoliday) {
    return studio.holidayPrice || studio.price || 0;
  }
  if (studio.isHolidayPrice && studio.weekdayPrice != null) {
    return studio.weekdayPrice;
  }
  return studio.price || 0;
}

module.exports = { calculate };
