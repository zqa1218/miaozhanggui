const { pool } = require('../config/database');
const Notification = require('../models/Notification');
const OperationLog = require('../models/OperationLog');

const AdminOrderController = {

  // GET /api/admin/orders — 订单列表 + 统计
  async list(req, res, next) {
    try {
      const mId = req.merchant.mId;
      const page = parseInt(req.query.page) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);
      const offset = (page - 1) * pageSize;
      const { status, date, studio_id, search } = req.query;

      let where = 'WHERE 1=1';
      const params = [];

      if (status) { where += ' AND o.status = ?'; params.push(status); }
      if (date) { where += ' AND DATE(o.created_at) = ?'; params.push(date); }
      if (studio_id) { where += ' AND o.studio_id = ?'; params.push(parseInt(studio_id)); }
      if (search) {
        where += ' AND (o.order_no LIKE ? OR o.user_name LIKE ? OR o.user_phone LIKE ?)';
        const s = `%${search}%`; params.push(s, s, s);
      }

      const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM orders o ${where}`, params);
      const [list] = await pool.query(
        `SELECT o.*, s.name AS studio_name FROM orders o
         LEFT JOIN studios s ON s.id = o.studio_id
         ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      // 附加每个订单的 slot_bookings
      if (list.length > 0) {
        const orderIds = list.map(o => o.id);
        const [slots] = await pool.query(
          `SELECT * FROM slot_bookings WHERE order_id IN (?) ORDER BY start_time ASC`,
          [orderIds]
        );
        const slotMap = {};
        slots.forEach(s => {
          if (!slotMap[s.order_id]) slotMap[s.order_id] = [];
          slotMap[s.order_id].push(s);
        });
        list.forEach(o => { o.slots = slotMap[o.id] || []; });
      }

      // 统计
      const [stats] = await pool.query(
        `SELECT
          SUM(CASE WHEN status IN ('pending','pre_paid','confirmed') THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS refunding,
          SUM(CASE WHEN status IN ('completed','expired') THEN 1 ELSE 0 END) AS completed
         FROM orders`
      );

      res.json({ success: true, data: { list, total, stats: stats[0] } });
    } catch (err) { next(err); }
  },

  // POST /api/admin/orders/update-status — 更新订单状态
  async updateStatus(req, res, next) {
    try {
      const { order_no, status } = req.body;
      if (!order_no || !status) return res.status(400).json({ success: false, message: '参数缺失' });

      const allowed = ['pre_paid','confirmed','completed','cancelled','expired'];
      if (!allowed.includes(status)) return res.status(400).json({ success: false, message: '无效状态' });

      // 如果确认订单 → 同时升级 slot 为 hard_lock
      if (status === 'confirmed') {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          await conn.query("UPDATE orders SET status='confirmed' WHERE order_no=?", [order_no]);
          await conn.query(
            "UPDATE slot_bookings SET status='hard_lock', locked_at=NULL, lock_expires_at=NULL, lock_version=lock_version+1 WHERE order_id=(SELECT id FROM orders WHERE order_no=?) AND status='pre_lock'",
            [order_no]
          );
          await conn.commit();
          conn.release();
        } catch (e) { await conn.rollback(); conn.release(); throw e; }
      } else if (status === 'cancelled') {
        await pool.query("UPDATE orders SET status='cancelled' WHERE order_no=?", [order_no]);
        await pool.query("UPDATE slot_bookings SET status='cancelled' WHERE order_id=(SELECT id FROM orders WHERE order_no=?)", [order_no]);
      } else {
        await pool.query("UPDATE orders SET status=? WHERE order_no=?", [status, order_no]);
      }

      await OperationLog.create({ m_id: req.merchant.mId, action: `订单 ${order_no} → ${status}`, order_no });
      res.json({ success: true, message: '状态已更新' });
    } catch (err) { next(err); }
  },
};

module.exports = AdminOrderController;
