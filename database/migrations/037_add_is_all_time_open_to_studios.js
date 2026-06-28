/**
 * 037: 为 studios 表新增 is_all_time_open 字段
 */
exports.up = async function (knex) {
  if (await knex.schema.hasTable('studios')) {
    const hasCol = await knex.schema.hasColumn('studios', 'is_all_time_open');
    if (!hasCol) {
      await knex.schema.alterTable('studios', (table) => {
        table.boolean('is_all_time_open').notNullable().defaultTo(false).comment('全时段模式，开启后所有日期可接单');
      });
    }
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasTable('studios')) {
    const hasCol = await knex.schema.hasColumn('studios', 'is_all_time_open');
    if (hasCol) {
      await knex.schema.alterTable('studios', (table) => {
        table.dropColumn('is_all_time_open');
      });
    }
  }
};
