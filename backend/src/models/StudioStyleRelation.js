const { pool } = require('../config/database');

const StudioStyleRelation = {
  async findByStudio(studioId) {
    const [rows] = await pool.query(
      `SELECT ssr.*, s.name AS style_name, s.cover_url AS style_cover_url
       FROM studio_style_relations ssr
       JOIN styles s ON s.id = ssr.style_id
       WHERE ssr.studio_id = ?
       ORDER BY ssr.sort_order ASC`,
      [studioId]
    );
    return rows;
  },

  async batchReplace(studioId, styleIds) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM studio_style_relations WHERE studio_id = ?', [studioId]);
      if (styleIds.length > 0) {
        const values = styleIds.map((sid, idx) => [studioId, sid, idx + 1]);
        await conn.query(
          'INSERT INTO studio_style_relations (studio_id, style_id, sort_order) VALUES ?',
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

module.exports = StudioStyleRelation;
