/**
 * 031: studios 表新增 extra_items 字段
 * 新建项目时可配置附加项目
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('studios', (table) => {
    table.json('extra_items').nullable().after('deposit_ratio').comment('附加项目JSON数组');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('studios', (table) => {
    table.dropColumn('extra_items');
  });
};
