/**
 * 029: 创建 style_additional_items 表 — 样式附加项目（化妆、道具等）
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('style_additional_items'))) {
    await knex.schema.createTable('style_additional_items', (table) => {
      table.bigIncrements('id').primary().unsigned();
      table.bigInteger('style_id').unsigned().notNullable().comment('所属样式');
      table.string('name', 64).notNullable().comment('附加项目名称');
      table.decimal('price', 10, 2).notNullable().comment('价格');
      table.enum('unit', ['per_session', 'per_photo', 'per_item'])
           .notNullable().defaultTo('per_session')
           .comment('计费单位: per_session=元/次, per_photo=元/张, per_item=元/个');
      table.dateTime('created_at').defaultTo(knex.fn.now());
      table.dateTime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      table.foreign('style_id').references('id').inTable('styles').onDelete('CASCADE');
      table.index('style_id', 'idx_sai_style_id');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('style_additional_items');
};
