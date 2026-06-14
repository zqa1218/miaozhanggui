exports.up = function (knex) {
  return knex.schema.createTable('reschedule_requests', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.string('m_id', 64).notNullable();
    table.string('order_no', 32).notNullable();
    table.date('old_date').notNullable();
    table.json('old_times').notNullable();
    table.date('new_date').notNullable();
    table.json('new_times').notNullable();
    table.string('reason', 512).nullable();
    table.enum('status', ['待处理', '已同意', '已拒绝']).defaultTo('待处理');
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.dateTime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.index(['m_id', 'status'], 'idx_resch_mid_status');
    table.index('order_no', 'idx_resch_order_no');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('reschedule_requests');
};
