/**
 * 036: 为 style_additional_items 添加面议相关字段
 */
exports.up = async function (knex) {
  if (await knex.schema.hasTable('style_additional_items')) {
    const hasNegotiable = await knex.schema.hasColumn('style_additional_items', 'negotiable');
    const hasMin = await knex.schema.hasColumn('style_additional_items', 'price_range_min');
    const hasMax = await knex.schema.hasColumn('style_additional_items', 'price_range_max');

    if (!hasNegotiable) {
      await knex.schema.alterTable('style_additional_items', (table) => {
        table.boolean('negotiable').notNullable().defaultTo(false).comment('是否面议');
      });
    }
    if (!hasMin) {
      await knex.schema.alterTable('style_additional_items', (table) => {
        table.decimal('price_range_min', 10, 2).notNullable().defaultTo(0.00).comment('面议价格区间下限');
      });
    }
    if (!hasMax) {
      await knex.schema.alterTable('style_additional_items', (table) => {
        table.decimal('price_range_max', 10, 2).notNullable().defaultTo(0.00).comment('面议价格区间上限');
      });
    }
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasTable('style_additional_items')) {
    const columns = ['negotiable', 'price_range_min', 'price_range_max'];
    for (const col of columns) {
      if (await knex.schema.hasColumn('style_additional_items', col)) {
        await knex.schema.alterTable('style_additional_items', (table) => {
          table.dropColumn(col);
        });
      }
    }
  }
};
