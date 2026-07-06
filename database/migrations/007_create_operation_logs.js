exports.up = function (knex) {
  return knex.schema.createTable('operation_logs', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.string('m_id', 64).notNullable();
    table.string('action', 512).notNullable();
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.index('m_id', 'idx_log_mid');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('operation_logs');
};
