/**
 * 030: orders 表新增附加项目字段
 * - 新增 selected_addon_ids (JSON) 存储用户选择的附加项目ID
 * - 新增 addon_total (DECIMAL) 存储附加项目合计金额
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.json('selected_addon_ids').nullable().after('deposit_ratio').comment('用户选择的附加项目ID数组');
    table.decimal('addon_total', 10, 2).defaultTo(0).after('selected_addon_ids').comment('附加项目合计金额');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('selected_addon_ids');
    table.dropColumn('addon_total');
  });
};
