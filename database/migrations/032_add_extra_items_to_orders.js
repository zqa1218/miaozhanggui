/**
 * 032: orders 表新增 extra_items 字段
 * - 新增 extra_items (JSON) 存储用户选择的附加项目详情（名称、单价、单位、金额）
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.json('extra_items').nullable().after('addon_total').comment('附加项目详情JSON数组');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('extra_items');
  });
};
