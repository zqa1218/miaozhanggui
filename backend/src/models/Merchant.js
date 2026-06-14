const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const Merchant = {
  async findByUsername(username) {
    const [rows] = await pool.query('SELECT * FROM merchants WHERE username = ?', [username]);
    return rows[0] || null;
  },

  async findByMId(mId) {
    const [rows] = await pool.query('SELECT * FROM merchants WHERE m_id = ?', [mId]);
    return rows[0] || null;
  },

  async create({ username, password, shop_name, shop_mode }) {
    const mId = 'M' + crypto.randomBytes(8).toString('hex');
    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO merchants (m_id, username, password_hash, shop_name, shop_mode) VALUES (?, ?, ?, ?, ?)',
      [mId, username, password_hash, shop_name, shop_mode || 'studio']
    );
    const [rows] = await pool.query('SELECT * FROM merchants WHERE id = ?', [result.insertId]);
    return rows[0];
  },

  async verifyPassword(merchant, password) {
    return bcrypt.compare(password, merchant.password_hash);
  },

  async updateSettings(mId, data) {
    // DB 列名（snake_case）→ 同时接受 camelCase 前端入参
    const allowed = ['shop_name','shop_mode','qr_code_url','alipay_qr_url','wechat_qr_url','announcement','declaration_enabled','declaration_content'];
    const camelMap = {
      shopName: 'shop_name', shopMode: 'shop_mode', qrCodeUrl: 'qr_code_url',
      alipayQrUrl: 'alipay_qr_url', wechatQrUrl: 'wechat_qr_url',
      paymentQrCode: 'payment_qrcode',
      declarationEnabled: 'declaration_enabled', declarationContent: 'declaration_content',
    };
    const fields = [], values = [];
    for (const [k, v] of Object.entries(data)) {
      const col = allowed.includes(k) ? k : (camelMap[k] || null);
      if (col && v !== undefined) { fields.push(`${col}=?`); values.push(v); }
    }
    if (!fields.length) return this.findByMId(mId);
    values.push(mId);
    await pool.query(`UPDATE merchants SET ${fields.join(',')} WHERE m_id=?`, values);
    return this.findByMId(mId);
  },
};

module.exports = Merchant;
