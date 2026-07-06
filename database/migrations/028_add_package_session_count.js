/**
 * 028: studios 添加 package_session_count 字段 — 套餐包含次数
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('studios', 'package_session_count'))) {
    await knex.schema.alterTable('studios', (t) => {
      t.integer('package_session_count').unsigned().defaultTo(1).comment('套餐包含次数');
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('studios', 'package_session_count')) {
    await knex.schema.alterTable('studios', (t) => t.dropColumn('package_session_count'));
  }
};
