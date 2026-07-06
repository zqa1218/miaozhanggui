exports.up = function (knex) {
  return knex.schema.alterTable('merchants', (table) => {
    table.string('alipay_qr_url', 512).nullable().comment('支付宝收款码');
    table.string('wechat_qr_url', 512).nullable().comment('微信收款码');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('merchants', (table) => {
    table.dropColumn('alipay_qr_url');
    table.dropColumn('wechat_qr_url');
  });
};
