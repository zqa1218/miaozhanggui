/**
 * 032: orders 表新增 extra_items 字段
 * - 新增 extra_items (JSON) 存储用户选择的附加项目详情（名称、单价、单位、金额）
 */
exports.up = async function (knex) {
  // ★ 幂等：线上库已通过裸 SQL 加过 extra_items，未纳入迁移记录，这里补 guard
  const has = await knex.schema.hasColumn('orders', 'extra_items');
  if (!has) {
    await knex.schema.alterTable('orders', (table) => {
      table.json('extra_items').nullable().after('addon_total').comment('附加项目详情JSON数组');
    });
  }
};

exports.down = async function (knex) {
  const has = await knex.schema.hasColumn('orders', 'extra_items');
  if (has) {
    await knex.schema.alterTable('orders', (table) => {
      table.dropColumn('extra_items');
    });
  }
};
