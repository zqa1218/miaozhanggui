const { pool } = require('../config/database');

const StudioRestSlot = {
  async findByStudio(studioId) {
    const [rows] = await pool.query(
      'SELECT * FROM studio_rest_slots WHERE studio_id = ? ORDER BY day_of_week ASC, start_time ASC',
      [studioId]
    );
    return rows;
  },

  async findByStudioAndDate(studioId, date) {
    // 获取当天的 day_of_week + 该日关联的 availability 专属休息段
    const dayOfWeek = new Date(date).getDay();
    const [rows] = await pool.query(
      `SELECT rs.* FROM studio_rest_slots rs
       LEFT JOIN studio_availabilities sa ON rs.availability_id = sa.id
       WHERE rs.studio_id = ?
         AND (rs.day_of_week = ? OR sa.date = ?)
       ORDER BY rs.start_time ASC`,
      [studioId, dayOfWeek, date]
    );
    return rows;
  },

  async batchReplace(studioId, slots) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM studio_rest_slots WHERE studio_id = ?', [studioId]);
      if (slots.length > 0) {
        const values = slots.map(s => [
          studioId,
          s.availability_id || null,
          s.day_of_week !== undefined ? s.day_of_week : null,
          s.start_time,
          s.end_time,
          s.reason || null,
        ]);
        await conn.query(
          `INSERT INTO studio_rest_slots (studio_id, availability_id, day_of_week, start_time, end_time, reason) VALUES ?`,
          [values]
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

module.exports = StudioRestSlot;
