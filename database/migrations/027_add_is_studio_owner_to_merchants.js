/**
 * 027: merchants 表增加 is_studio_owner 字段 — 棚主账号标识
 * 预留接口：其他后台可通过该字段判断账号类型，做差异化处理
 */
exports.up = async function (knex) {
  const has = await knex.schema.hasColumn('merchants', 'is_studio_owner');
  if (!has) {
    await knex.schema.alterTable('merchants', (table) => {
      table.boolean('is_studio_owner').notNullable().defaultTo(false).comment('是否棚主账号: 0=普通商家 1=棚主');
    });
  }
};

exports.down = async function (knex) {
  const has = await knex.schema.hasColumn('merchants', 'is_studio_owner');
  if (has) {
    await knex.schema.alterTable('merchants', (table) => {
      table.dropColumn('is_studio_owner');
    });
  }
};
