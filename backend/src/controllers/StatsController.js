const { pool } = require('../config/database');

const StatsController = {
  async orderStats(req, res, next) {
    try {
      const mId = req.merchant.mId;
      const today = new Date().toISOString().slice(0, 10);
      const [[{ revenue }]] = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM orders
         WHERE created_at >= ? AND status NOT IN ('cancelled','expired')`, [today]
      );
      res.json({ success: true, data: { revenue: Math.round(revenue * 100) / 100 } });
    } catch (err) { next(err); }
  },
};
module.exports = StatsController;
