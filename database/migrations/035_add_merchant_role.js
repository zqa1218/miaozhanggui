/**
 * 035: merchants 表增加 merchant_role 字段 — 商家身份标识
 * photographer: 摄影 | makeup_artist: 妆娘 | studio_owner: 棚主
 */
exports.up = async function (knex) {
  const has = await knex.schema.hasColumn('merchants', 'merchant_role');
  if (!has) {
    await knex.schema.alterTable('merchants', (table) => {
      table.enum('merchant_role', ['photographer', 'makeup_artist', 'studio_owner'])
        .notNullable()
        .defaultTo('photographer')
        .comment('商家身份: photographer=摄影 makeup_artist=妆娘 studio_owner=棚主');
    });
  }
};

exports.down = async function (knex) {
  const has = await knex.schema.hasColumn('merchants', 'merchant_role');
  if (has) {
    await knex.schema.alterTable('merchants', (table) => {
      table.dropColumn('merchant_role');
    });
  }
};
