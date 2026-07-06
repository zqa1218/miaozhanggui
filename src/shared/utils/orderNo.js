const crypto = require('crypto');

/**
 *   生成唯一订单号
 *   格式: ord_{10位时间戳}_{6位随机hex}
 *   示例: ord_1700000000_a3f2c1
 */
function generateOrderNo() {
  const ts = Math.floor(Date.now() / 1000).toString();
  const rand = crypto.randomBytes(3).toString('hex');
  return `ord_${ts}_${rand}`;
}

module.exports = { generateOrderNo };
