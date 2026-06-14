/**
 * 024: 创建 style_packages 表 — 支持每个样式配置多个套餐
 */
exports.up = async function (knex) {
  await knex.schema.createTable('style_packages', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.bigInteger('style_id').unsigned().notNullable().comment('所属样式');
    table.string('name', 64).notNullable().comment('套餐名称');
    table.integer('photo_count').unsigned().notNullable().defaultTo(1).comment('包含张数');
    table.decimal('total_price', 10, 2).notNullable().comment('套餐固定总价');
    table.integer('fixed_duration').unsigned().notNullable().comment('套餐固定耗时(分钟)');
    table.string('description', 256).nullable().comment('套餐描述');
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.dateTime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    table.index('style_id', 'idx_sp_style');
    table.foreign('style_id').references('styles.id').onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('style_packages');
};
