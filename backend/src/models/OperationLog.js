const { pool } = require('../config/database');

const OperationLog = {
  async findByMId(mId) {
    const [rows] = await pool.query(
      'SELECT * FROM operation_logs WHERE m_id = ? ORDER BY created_at DESC LIMIT 500', [mId]
    );
    return rows;
  },
  async create({ m_id, action, order_no, detail }) {
    await pool.query(
      'INSERT INTO operation_logs (m_id, action, order_no, detail) VALUES (?,?,?,?)',
      [m_id, action, order_no || null, detail || null]
    );
  },
  async clear(mId) {
    await pool.query('DELETE FROM operation_logs WHERE m_id = ?', [mId]);
  },
};
module.exports = OperationLog;
