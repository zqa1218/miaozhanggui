const Order = require('../models/Order');
const SlotBooking = require('../models/SlotBooking');
const Studio = require('../models/Studio');
const { getConnection } = require('../config/database');
const { calculateOrderTimeBlock } = require('./TimeBlockCalculator');
const { AppError } = require('../middleware/errorHandler');

/**
 * 预约核心服务 — 高并发双锁引擎
 *
 * 完整流转链路:
 *   POST /api/pay-deposit      → payDeposit()    → slot.status = pre_lock  (定金锁)
 *   POST /api/order/confirm-lock → confirmLock()   → slot.status = hard_lock (确认锁)
 *
 * 双锁机制:
 *   pre_lock (悲观行级锁 SELECT ... FOR UPDATE):
 *     用户付定金时写入，15分钟过期。事务内锁定目标日全部有效行，
 *     强制校验与已有 slot_bookings + studio_rest_slots 是否重叠。
 *
 *   hard_lock (乐观锁 lock_version):
 *     摄影师确认时从 pre_lock 升级。使用 WHERE lock_version = :old 防并发覆盖。
 */
const BookingService = {
  // =============================================================
  // 1. 定金锁 (pre_lock) — 用户支付定金
  // =============================================================

  /**
   * @param {Object} params
   * @param {number} params.studio_id
   * @param {number} params.user_id
   * @param {string} params.user_name
   * @param {string} params.user_phone
   * @param {'single'|'package'} params.pricing_type
   * @param {number} params.quantity          - 张数或套餐数
   * @param {boolean} params.is_new_customer
   * @param {string} params.start_time       - 期望开始时间 "HH:mm"
   * @param {string} params.booking_date     - 预约日期 "YYYY-MM-DD"
   * @param {string} [params.remark]
   */
  async payDeposit(params) {
    const {
      studio_id, user_id, user_name, user_phone,
      pricing_type, quantity, is_new_customer,
      start_time, booking_date, remark,
    } = params;

    // ---- 1a. 校验项目 ----
    const studio = await Studio.findById(studio_id);
    if (!studio || studio.status !== 1) {
      throw new AppError('项目不存在或已下架', 400, 'STUDIO_UNAVAILABLE');
    }
    if (studio.pricing_model !== 'both' && studio.pricing_model !== pricing_type) {
      throw new AppError('定价模式不匹配', 400, 'PRICING_MISMATCH');
    }

    // ---- 1b. 精算闭合时间段 ----
    const block = calculateOrderTimeBlock({
      pricing_type,
      quantity,
      is_new_customer: !!is_new_customer,
      start_time,
      studio,
    });

    // ---- 1c. 计算金额 ----
    let totalAmount;
    if (pricing_type === 'single') {
      totalAmount = parseFloat(studio.single_price) * quantity;
    } else {
      totalAmount = parseFloat(studio.package_price) * quantity;
    }
    const depositAmount = Math.round(totalAmount * 0.3 * 100) / 100; // 30% 定金

    // ---- 1d. 生成订单号 ----
    const orderNo = generateOrderNo();

    // ---- 1e. 事务内双锁引擎 ----
    const conn = await getConnection();

    try {
      await conn.beginTransaction();

      // ① 校验该日是否开放
      const availability = await SlotBooking.findAvailability(conn, studio_id, booking_date);
      if (!availability) {
        throw new AppError('该日不开放预约', 400, 'DATE_UNAVAILABLE');
      }

      // ② 校验时段是否超出营业范围
      if (block.start_time < availability.start_time || block.end_time > availability.end_time) {
        throw new AppError(
          `时段超出营业范围 (${availability.start_time} - ${availability.end_time})`,
          400,
          'OUT_OF_BUSINESS_HOURS'
        );
      }

      // ③ 查已有时段重叠 (SELECT ... FOR UPDATE 行级锁)
      const overlappingSlots = await SlotBooking.findOverlapping(
        conn, studio_id, booking_date, block.start_time, block.end_time
      );
      if (overlappingSlots.length > 0) {
        throw new AppError(
          `时段与已有预约重叠: ${overlappingSlots.map(s => `${s.start_time}-${s.end_time}[${s.status}]`).join(', ')}`,
          409,
          'SLOT_CONFLICT'
        );
      }

      // ④ 查休息段重叠
      const restOverlap = await SlotBooking.findRestSlotOverlap(
        conn, studio_id, booking_date, block.start_time, block.end_time
      );
      if (restOverlap.length > 0) {
        throw new AppError(
          `时段与商家休息段重叠: ${restOverlap.map(r => `${r.start_time}-${r.end_time}(${r.reason})`).join(', ')}`,
          409,
          'REST_SLOT_CONFLICT'
        );
      }

      // ⑤ 创建订单 (status=pending)
      const [orderResult] = await conn.query(
        `INSERT INTO orders (order_no, studio_id, user_id, user_name, user_phone, pricing_type, total_amount, deposit_amount, status, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [orderNo, studio_id, user_id || null, user_name, user_phone, pricing_type, totalAmount, depositAmount, remark || null]
      );
      const orderId = orderResult.insertId;

      // ⑥ 写入 pre_lock 时段
      const slot = await SlotBooking.preLock(conn, {
        order_id: orderId,
        studio_id,
        booking_date,
        start_time: block.start_time,
        end_time: block.end_time,
      });

      // ⑦ 更新订单为 pre_paid
      await conn.query("UPDATE orders SET status = 'pre_paid' WHERE id = ?", [orderId]);

      await conn.commit();
      conn.release();

      // ⑧ 查询完整结果
      return { ...(await Order.findById(orderId)), slots: [slot], time_block: block };

    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  },

  // =============================================================
  // 2. 确认锁 (hard_lock) — 摄影师确认预约
  // =============================================================

  /**
   * 摄影师确认预约，将订单下所有 pre_lock 时段升级为 hard_lock
   *
   * @param {number} orderId
   * @returns {object} 更新后的订单含时段
   */
  async confirmLock(orderId) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('订单不存在', 404, 'ORDER_NOT_FOUND');
    }
    if (order.status !== 'pre_paid') {
      throw new AppError('订单状态不正确，当前状态: ' + order.status, 400, 'INVALID_ORDER_STATUS');
    }

    // 获取订单所有时段
    const slots = await SlotBooking.findByOrder(orderId);
    if (slots.length === 0) {
      throw new AppError('订单无关联时段', 400, 'NO_SLOTS');
    }

    // 逐一时段升级（乐观锁校验）
    const failedSlots = [];
    for (const slot of slots) {
      if (slot.status !== 'pre_lock') {
        failedSlots.push({ id: slot.id, reason: `状态为 ${slot.status} 而非 pre_lock` });
        continue;
      }
      const ok = await SlotBooking.upgradeToHardLock(slot.id, slot.lock_version);
      if (!ok) {
        failedSlots.push({ id: slot.id, reason: '乐观锁版本冲突' });
      }
    }

    if (failedSlots.length > 0) {
      throw new AppError(
        `部分时段确认失败: ${JSON.stringify(failedSlots)}`,
        409,
        'CONFIRM_CONFLICT'
      );
    }

    // 更新订单状态
    await Order.updateStatus(orderId, 'confirmed');

    return Order.findWithSlots(orderId);
  },

  // =============================================================
  // 3. 取消订单
  // =============================================================
  async cancelOrder(orderId) {
    await SlotBooking.cancelByOrder(orderId);
    await Order.updateStatus(orderId, 'cancelled');
  },

  // =============================================================
  // 4. 查询可用时段（对外）
  // =============================================================
  async getAvailableSlots(studioId, date) {
    const AvailabilityService = require('./AvailabilityService');
    const slots = await AvailabilityService.getDailySlots(studioId, date);
    return slots;
  },
};

function generateOrderNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BO${y}${m}${d}${h}${mm}${rand}`;
}

module.exports = BookingService;
