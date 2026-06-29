exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('studios', 'sort_order');
  if (!hasColumn) {
    await knex.schema.alterTable('studios', (table) => {
      table.integer('sort_order').notNullable().defaultTo(0).index()
        .comment('C端展示排序，越小越靠前，0=未设置');
    });
  }
};

exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('studios', 'sort_order');
  if (hasColumn) {
    await knex.schema.alterTable('studios', (table) => {
      table.dropColumn('sort_order');
    });
  }
};
