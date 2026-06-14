const BookingService = require('../services/BookingService');

const BookingController = {
  /**
   * GET /api/bookings/available?studio_id=1&date=2026-07-01
   */
  async available(req, res, next) {
    try {
      const { studio_id, date } = req.query;
      if (!studio_id || !date) {
        return res.status(400).json({ success: false, message: '缺少 studio_id 或 date 参数' });
      }
      const slots = await BookingService.getAvailableSlots(parseInt(studio_id), date);
      res.json({ success: true, data: { date, slots } });
    } catch (err) { next(err); }
  },

  /**
   * POST /api/pay-deposit
   *
   * Body: {
   *   studio_id, user_name, user_phone, pricing_type, quantity,
   *   is_new_customer, start_time, booking_date, remark
   * }
   */
  async payDeposit(req, res, next) {
    try {
      const order = await BookingService.payDeposit(req.body);
      res.status(201).json({
        success: true,
        data: order,
        message: `定金锁成功，时段: ${order.time_block.start_time}-${order.time_block.end_time}`,
      });
    } catch (err) { next(err); }
  },

  /**
   * POST /api/order/confirm-lock
   *
   * Body: { order_id: number }
   */
  async confirmLock(req, res, next) {
    try {
      const { order_id } = req.body;
      if (!order_id) {
        return res.status(400).json({ success: false, message: '缺少 order_id' });
      }
      const order = await BookingService.confirmLock(parseInt(order_id));
      res.json({
        success: true,
        data: order,
        message: '确认锁成功，摄影师已确认预约',
      });
    } catch (err) { next(err); }
  },

  /**
   * POST /api/order/:id/cancel
   */
  async cancel(req, res, next) {
    try {
      await BookingService.cancelOrder(parseInt(req.params.id));
      res.json({ success: true, message: '订单已取消' });
    } catch (err) { next(err); }
  },
};

module.exports = BookingController;
