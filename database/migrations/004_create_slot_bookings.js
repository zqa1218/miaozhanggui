exports.up = function (knex) {
  return knex.schema.createTable('slot_bookings', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.string('m_id', 64).notNullable();
    table.bigInteger('studio_id').unsigned().notNullable();
    table.date('booking_date').notNullable();
    table.string('time_slot', 8).notNullable().comment('HH:MM');
    table.string('order_no', 32).notNullable();
    table.boolean('is_package_day').defaultTo(false);
    table.integer('booking_count').defaultTo(1).comment('photo_time模式的占用数');
    table.dateTime('created_at').defaultTo(knex.fn.now());
    // 联合唯一索引：防止同一时段重复预订
    table.unique(['m_id', 'studio_id', 'booking_date', 'time_slot'], 'uq_slot');
    table.index('order_no', 'idx_slot_order_no');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('slot_bookings');
};
