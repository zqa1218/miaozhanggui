const { pool } = require('../config/database');

const StudioAvailability = {
  async findByStudio(studioId, { dateFrom, dateTo } = {}) {
    let sql = 'SELECT * FROM studio_availabilities WHERE studio_id = ? AND is_active = 1';
    const values = [studioId];
    if (dateFrom) { sql += ' AND date >= ?'; values.push(dateFrom); }
    if (dateTo)   { sql += ' AND date <= ?'; values.push(dateTo); }
    sql += ' ORDER BY date ASC';
    const [rows] = await pool.query(sql, values);
    return rows;
  },

  async findOne(studioId, date) {
    const [rows] = await pool.query(
      'SELECT * FROM studio_availabilities WHERE studio_id = ? AND date = ?',
      [studioId, date]
    );
    return rows[0] || null;
  },

  async batchUpsert(studioId, dates) {
    // dates: [{ date, start_time, end_time }]
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const d of dates) {
        await conn.query(
          `INSERT INTO studio_availabilities (studio_id, date, start_time, end_time)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time), is_active = 1`,
          [studioId, d.date, d.start_time, d.end_time]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = StudioAvailability;
