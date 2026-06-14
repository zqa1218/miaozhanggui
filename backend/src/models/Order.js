const { pool } = require('../config/database');

const Order = {
  async findByOrderNo(orderNo) {
    const [rows] = await pool.query('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findWithSlots(id) {
    const order = await this.findById(id);
    if (!order) return null;
    const [slots] = await pool.query(
      'SELECT * FROM slot_bookings WHERE order_id = ? ORDER BY start_time ASC',
      [id]
    );
    return { ...order, slots };
  },

  async create(data) {
    const { order_no, studio_id, user_id, user_name, user_phone, pricing_type, total_amount, deposit_amount, remark } = data;
    const [result] = await pool.query(
      `INSERT INTO orders (order_no, studio_id, user_id, user_name, user_phone, pricing_type, total_amount, deposit_amount, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_no, studio_id, user_id || null, user_name, user_phone, pricing_type, total_amount, deposit_amount || null, remark || null]
    );
    return this.findById(result.insertId);
  },

  async updateStatus(id, status) {
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    return this.findById(id);
  },
};

module.exports = Order;
