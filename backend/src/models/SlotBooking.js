const { pool, getConnection } = require('../config/database');
const config = require('../config');

const SlotBooking = {
  LOCK_MINUTES: config.slot.lockTimeoutMinutes,

  /**
   * 查询某项目某日的所有有效预约时段
   * 排除已取消 + 过期的 pre_lock（超时未付定金）
   */
  async findActiveByStudioDate(studioId, date) {
    const [rows] = await pool.query(
      `SELECT * FROM slot_bookings
       WHERE studio_id = ? AND booking_date = ? AND status != 'cancelled'
         AND NOT (status = 'pre_lock' AND lock_expires_at IS NOT NULL AND lock_expires_at < NOW())
       ORDER BY start_time ASC`,
      [studioId, date]
    );
    return rows;
  },

  /**
   * 查找与指定时段重叠的有效记录（含 pre_lock 未过期 + hard_lock）
   * 返回重叠记录列表，空数组表示无冲突
   */
  async findOverlapping(conn, studioId, date, startTime, endTime) {
    const [rows] = await conn.query(
      `SELECT id, start_time, end_time, status, lock_expires_at, lock_version
       FROM slot_bookings
       WHERE studio_id   = ? AND booking_date = ? AND status != 'cancelled'
         AND NOT (status = 'pre_lock' AND lock_expires_at IS NOT NULL AND lock_expires_at < NOW())
         AND start_time  < ? AND end_time > ?
       FOR UPDATE`,
      [studioId, date, endTime, startTime]
    );
    return rows;
  },

  /**
   * 查询休息段是否与目标时段重叠
   */
  async findRestSlotOverlap(conn, studioId, date, startTime, endTime) {
    const dayOfWeek = new Date(date).getDay();
    const [rows] = await conn.query(
      `SELECT id, start_time, end_time, reason FROM studio_rest_slots
       WHERE studio_id = ?
         AND (day_of_week = ? OR availability_id IN (
           SELECT id FROM studio_availabilities WHERE studio_id = ? AND date = ?
         ))
         AND start_time < ? AND end_time > ?
       FOR UPDATE`,
      [studioId, dayOfWeek, studioId, date, endTime, startTime]
    );
    return rows;
  },

  /**
   * 验证该日是否为开放日
   */
  async findAvailability(conn, studioId, date) {
    const [rows] = await conn.query(
      `SELECT * FROM studio_availabilities
       WHERE studio_id = ? AND date = ? AND is_active = 1
       FOR UPDATE`,
      [studioId, date]
    );
    return rows[0] || null;
  },

  // ===================== 双锁核心操作 =====================

  /**
   * pre_lock — 用户支付定金后写入
   * 在 BookingService.transaction 内调用，conn 为事务连接
   *
   * @returns {object} 插入的记录
   */
  async preLock(conn, { order_id, studio_id, booking_date, start_time, end_time }) {
    const lockExpiresAt = new Date(Date.now() + this.LOCK_MINUTES * 60 * 1000);

    const [result] = await conn.query(
      `INSERT INTO slot_bookings (order_id, studio_id, booking_date, start_time, end_time, status, locked_at, lock_expires_at)
       VALUES (?, ?, ?, ?, ?, 'pre_lock', NOW(), ?)`,
      [order_id, studio_id, booking_date, start_time, end_time, lockExpiresAt]
    );

    const [rows] = await conn.query('SELECT * FROM slot_bookings WHERE id = ?', [result.insertId]);
    return rows[0];
  },

  /**
   * hard_lock — 摄影师确认，将 pre_lock 升级为 hard_lock
   * 使用乐观锁校验: WHERE lock_version = currentVersion
   *
   * @returns {boolean} 是否升级成功
   */
  async upgradeToHardLock(id, currentVersion) {
    const [result] = await pool.query(
      `UPDATE slot_bookings
       SET status = 'hard_lock', locked_at = NULL, lock_expires_at = NULL, lock_version = lock_version + 1
       WHERE id = ? AND lock_version = ? AND status = 'pre_lock'`,
      [id, currentVersion]
    );
    return result.affectedRows > 0;
  },

  /**
   * 取消单个时段
   */
  async cancel(id) {
    await pool.query(
      "UPDATE slot_bookings SET status = 'cancelled' WHERE id = ?",
      [id]
    );
  },

  /**
   * 批量取消订单下所有时段
   */
  async cancelByOrder(orderId) {
    await pool.query(
      "UPDATE slot_bookings SET status = 'cancelled' WHERE order_id = ?",
      [orderId]
    );
  },

  /**
   * 清理过期 pre_lock（定时任务）
   */
  async releaseExpiredLocks() {
    const [result] = await pool.query(
      "UPDATE slot_bookings SET status = 'cancelled' WHERE status = 'pre_lock' AND lock_expires_at < NOW()"
    );
    return result.affectedRows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM slot_bookings WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findByOrder(orderId) {
    const [rows] = await pool.query(
      'SELECT * FROM slot_bookings WHERE order_id = ? ORDER BY start_time ASC',
      [orderId]
    );
    return rows;
  },
};

module.exports = SlotBooking;
