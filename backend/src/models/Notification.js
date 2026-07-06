const { pool } = require('../config/database');

const Notification = {
  async findByMId(mId) {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE m_id = ? ORDER BY created_at DESC LIMIT 200', [mId]
    );
    return rows;
  },
  async unreadCount(mId) {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE m_id = ? AND is_read = 0', [mId]
    );
    return count;
  },
  async create({ m_id, title, content, type, order_no }) {
    const [r] = await pool.query(
      'INSERT INTO notifications (m_id, title, content, type, order_no) VALUES (?,?,?,?,?)',
      [m_id, title, content, type || 'info', order_no || null]
    );
    return r.insertId;
  },
  async markRead(mId, ids) {
    if (ids && ids.length) {
      await pool.query('UPDATE notifications SET is_read=1 WHERE m_id=? AND id IN (?)', [mId, ids]);
    } else {
      await pool.query('UPDATE notifications SET is_read=1 WHERE m_id=?', [mId]);
    }
  },
};
module.exports = Notification;
