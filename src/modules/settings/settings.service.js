const merchantRepo = require('../merchant/merchant.repository');

async function getSettings(mId) {
  const m = await merchantRepo.findByMId(mId);
  if (!m) return null;
  return {
    mId: m.m_id,
    shopName: m.shop_name,
    shopMode: m.shop_mode,
    qrCodeUrl: m.qr_code_url || '',
    alipayQrUrl: m.alipay_qr_url || '',
    wechatQrUrl: m.wechat_qr_url || '',
    paymentQrCode: m.payment_qrcode || '',
    announcement: m.announcement || '',
    declarationEnabled: !!m.declaration_enabled,
    declarationContent: m.declaration_content || '',
  };
}

async function saveSettings(data) {
  const updates = {};
  if (data.shopName !== undefined) updates.shop_name = data.shopName;
  if (data.shopMode !== undefined) updates.shop_mode = data.shopMode;
  if (data.qrCodeUrl !== undefined) updates.qr_code_url = data.qrCodeUrl;
  if (data.alipayQrUrl !== undefined) updates.alipay_qr_url = data.alipayQrUrl;
  if (data.wechatQrUrl !== undefined) updates.wechat_qr_url = data.wechatQrUrl;
  if (data.paymentQrCode !== undefined) updates.payment_qrcode = data.paymentQrCode;
  if (data.announcement !== undefined) updates.announcement = data.announcement;
  if (data.declarationEnabled !== undefined) updates.declaration_enabled = data.declarationEnabled;
  if (data.declarationContent !== undefined) updates.declaration_content = data.declarationContent;
  await merchantRepo.updateByMId(data.mId, updates);
  return { success: true };
}

module.exports = { getSettings, saveSettings };
