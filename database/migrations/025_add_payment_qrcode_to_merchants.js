/**
 * 025: merchants 表增加 payment_qrcode 字段 — 统一收款码
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasColumn('merchants', 'payment_qrcode');
  if (!exists) {
    await knex.schema.alterTable('merchants', (table) => {
      table.string('payment_qrcode', 512).nullable().comment('统一收款码二维码URL');
    });
  }
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasColumn('merchants', 'payment_qrcode');
  if (exists) {
    await knex.schema.alterTable('merchants', (table) => {
      table.dropColumn('payment_qrcode');
    });
  }
};
