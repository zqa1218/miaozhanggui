/**
 * 018: 创建 studio_style_relations / studio_availabilities / studio_rest_slots
 */
exports.up = async function (knex) {
  // 1. 项目-样式多对多关联表
  await knex.schema.createTable('studio_style_relations', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.bigInteger('studio_id').unsigned().notNullable().comment('项目ID');
    table.bigInteger('style_id').unsigned().notNullable().comment('样式ID');
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.unique(['studio_id', 'style_id'], 'uq_studio_style');
    table.index('studio_id', 'idx_ssr_studio');
    table.index('style_id', 'idx_ssr_style');
  });

  // 2. 项目开放日期表
  await knex.schema.createTable('studio_availabilities', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.bigInteger('studio_id').unsigned().notNullable().comment('项目ID');
    table.date('available_date').notNullable().comment('可选日期');
    table.unique(['studio_id', 'available_date'], 'uq_studio_date');
    table.index('studio_id', 'idx_sa_studio');
  });

  // 3. 项目休息时段表
  await knex.schema.createTable('studio_rest_slots', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.bigInteger('studio_id').unsigned().notNullable().comment('项目ID');
    table.time('start_time').notNullable().comment('休息开始时间');
    table.time('end_time').notNullable().comment('休息结束时间');
    table.index('studio_id', 'idx_srs_studio');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('studio_rest_slots');
  await knex.schema.dropTableIfExists('studio_availabilities');
  await knex.schema.dropTableIfExists('studio_style_relations');
};
