const Merchant = require('../models/Merchant');
const Notification = require('../models/Notification');

const SettingsController = {

  // GET /api/settings?mId=xxx — C端公开接口
  async getPublic(req, res, next) {
    try {
      const mId = req.query.mId;
      if (!mId) return res.status(400).json({ success: false, message: '缺少mId' });
      const m = await Merchant.findByMId(mId);
      if (!m) return res.status(404).json({ success: false, message: '商户不存在' });
      res.json({ success: true, data: {
        shopName: m.shop_name,
        shopMode: m.shop_mode,
        announcement: m.announcement,
        qrCodeUrl: m.qr_code_url,
        alipayQrUrl: m.alipay_qr_url,
        wechatQrUrl: m.wechat_qr_url,
        declarationEnabled: m.declaration_enabled || false,
        declarationContent: m.declaration_content || '',
      }});
    } catch (err) { next(err); }
  },

  // GET /api/settings — B端需登录
  async getMine(req, res, next) {
    try {
      const m = await Merchant.findByMId(req.merchant.mId);
      res.json({ success: true, data: {
        shopName: m.shop_name, shopMode: m.shop_mode,
        announcement: m.announcement, qrCodeUrl: m.qr_code_url,
        alipayQrUrl: m.alipay_qr_url, wechatQrUrl: m.wechat_qr_url,
        declarationEnabled: m.declaration_enabled || false,
        declarationContent: m.declaration_content || '',
      }});
    } catch (err) { next(err); }
  },

  // POST /api/settings — B端保存设置
  async save(req, res, next) {
    try {
      const m = await Merchant.updateSettings(req.merchant.mId, req.body);
      res.json({ success: true, data: {
        shopName: m.shop_name, shopMode: m.shop_mode,
        announcement: m.announcement, qrCodeUrl: m.qr_code_url,
        alipayQrUrl: m.alipay_qr_url, wechatQrUrl: m.wechat_qr_url,
        declarationEnabled: m.declaration_enabled || false,
        declarationContent: m.declaration_content || '',
      }});
    } catch (err) { next(err); }
  },
};
module.exports = SettingsController;
