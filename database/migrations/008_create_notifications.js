exports.up = function (knex) {
  return knex.schema.createTable('notifications', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.string('m_id', 64).notNullable();
    table.string('title', 256).notNullable();
    table.text('content').nullable();
    table.enum('type', ['info', 'success', 'warning', 'danger']).defaultTo('info');
    table.string('order_no', 32).nullable();
    table.boolean('is_read').defaultTo(false);
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.index(['m_id', 'is_read'], 'idx_noti_mid_read');
    table.index(['m_id', 'created_at'], 'idx_noti_mid_created');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('notifications');
};
