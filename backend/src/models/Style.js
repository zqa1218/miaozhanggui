const { pool } = require('../config/database');

const Style = {
  async findAll({ status = 1 } = {}) {
    const [rows] = await pool.query(
      'SELECT * FROM styles WHERE status = ? ORDER BY id DESC',
      [status]
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM styles WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create(data) {
    const { name, description, cover_url, preview_urls } = data;
    const [result] = await pool.query(
      'INSERT INTO styles (name, description, cover_url, preview_urls) VALUES (?, ?, ?, ?)',
      [name, description, cover_url, JSON.stringify(preview_urls)]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (['name', 'description', 'cover_url', 'preview_urls', 'status'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(key === 'preview_urls' ? JSON.stringify(val) : val);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE styles SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM styles WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = Style;
