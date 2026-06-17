const Merchant = require('../models/Merchant');
const { signToken } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const AuthService = {
  async register({ username, password, shopName, shopMode }) {
    if (!username || username.length < 3) throw new AppError('账号至少3个字符', 400);
    if (!password || password.length < 6) throw new AppError('密码至少6个字符', 400);
    const existing = await Merchant.findByUsername(username);
    if (existing) throw new AppError('账号已存在', 409);
    const m = await Merchant.create({ username, password, shop_name: shopName, shop_mode: shopMode || 'studio' });
    const token = signToken({ mId: m.m_id, username: m.username, shopMode: m.shop_mode });
    return { token, mId: m.m_id, shopName: m.shop_name, shopMode: m.shop_mode, message: `注册成功！你的商家ID: ${m.m_id}` };
  },

  async login({ username, password }) {
    const m = await Merchant.findByUsername(username);
    if (!m) throw new AppError('账号或密码错误', 401);
    const ok = await Merchant.verifyPassword(m, password);
    if (!ok) throw new AppError('账号或密码错误', 401);
    const token = signToken({ mId: m.m_id, username: m.username, shopMode: m.shop_mode });
    return { token, mId: m.m_id, shopName: m.shop_name, shopMode: m.shop_mode };
  },
};

module.exports = AuthService;
