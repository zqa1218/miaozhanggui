const { pool } = require('../config/database');

const Studio = {
  TABLE: 'studios',

  async findAll({ status = 1, pricing_model } = {}) {
    let sql = 'SELECT * FROM studios WHERE status = ?';
    const values = [status];
    if (pricing_model) {
      sql += ' AND pricing_model IN (?, "both")';
      values.push(pricing_model);
    }
    sql += ' ORDER BY id DESC';
    const [rows] = await pool.query(sql, values);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM studios WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findByIdWithStyles(id) {
    const [rows] = await pool.query(
      `SELECT s.*, GROUP_CONCAT(ssr.style_id) AS style_ids
       FROM studios s
       LEFT JOIN studio_style_relations ssr ON s.id = ssr.studio_id
       WHERE s.id = ?
       GROUP BY s.id`,
      [id]
    );
    return rows[0] || null;
  },

  async create(data) {
    const fields = ['name'];
    const values = [data.name];
    const optionalFields = ['description', 'cover_url', 'detail_urls', 'is_style_enabled',
      'pricing_model', 'single_price', 'package_price', 'package_session_count', 'package_details',
      'single_duration_minutes', 'package_session_duration_minutes', 'rest_interval_minutes', 'new_customer_extra_minutes',
      'contact_phone', 'contact_wechat', 'remark'];
    for (const f of optionalFields) {
      if (data[f] !== undefined) {
        fields.push(f);
        values.push(['detail_urls', 'package_details'].includes(f) ? JSON.stringify(data[f]) : data[f]);
      }
    }
    const placeholders = fields.map(() => '?').join(', ');
    const [result] = await pool.query(
      `INSERT INTO studios (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const allowed = ['name', 'description', 'cover_url', 'detail_urls', 'is_style_enabled',
      'pricing_model', 'single_price', 'package_price', 'package_session_count', 'package_details',
      'single_duration_minutes', 'package_session_duration_minutes', 'rest_interval_minutes', 'new_customer_extra_minutes',
      'contact_phone', 'contact_wechat', 'remark', 'status'];
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (allowed.includes(key) && val !== undefined) {
        fields.push(`${key} = ?`);
        values.push(['detail_urls', 'package_details'].includes(key) ? JSON.stringify(val) : val);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE studios SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM studios WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = Studio;
