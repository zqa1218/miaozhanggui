/**
 * 027: orders 表增加 contact_type / contact_value 字段 — 分离联系方式类型与值
 */
exports.up = async function (knex) {
  const hasType = await knex.schema.hasColumn('orders', 'contact_type');
  if (!hasType) {
    await knex.schema.alterTable('orders', (table) => {
      table.string('contact_type', 32).nullable().comment('联系方式类型: qq/wechat/phone/other');
    });
  }
  const hasValue = await knex.schema.hasColumn('orders', 'contact_value');
  if (!hasValue) {
    await knex.schema.alterTable('orders', (table) => {
      table.string('contact_value', 128).nullable().comment('联系方式值');
    });
  }
};

exports.down = async function (knex) {
  const hasType = await knex.schema.hasColumn('orders', 'contact_type');
  if (hasType) {
    await knex.schema.alterTable('orders', (table) => {
      table.dropColumn('contact_type');
    });
  }
  const hasValue = await knex.schema.hasColumn('orders', 'contact_value');
  if (hasValue) {
    await knex.schema.alterTable('orders', (table) => {
      table.dropColumn('contact_value');
    });
  }
};
