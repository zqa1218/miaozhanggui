exports.up = async function (knex) {
  // orders: add time_slots_end JSON column (parallel to time_slots)
  await knex.schema.alterTable('orders', (table) => {
    table.json('time_slots_end').nullable().comment('结束时段数组，与 time_slots 一一对应');
  });

  // slot_bookings: add time_slot_end
  await knex.schema.alterTable('slot_bookings', (table) => {
    table.string('time_slot_end', 8).nullable().comment('结束时段 HH:MM');
  });

  // unavailable_slots: add time_slot_end
  await knex.schema.alterTable('unavailable_slots', (table) => {
    table.string('time_slot_end', 8).nullable().comment('结束时段 HH:MM');
  });

  // reschedule_requests: add old_times_end and new_times_end
  await knex.schema.alterTable('reschedule_requests', (table) => {
    table.json('old_times_end').nullable().comment('原结束时段数组');
    table.json('new_times_end').nullable().comment('新结束时段数组');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('time_slots_end');
  });
  await knex.schema.alterTable('slot_bookings', (table) => {
    table.dropColumn('time_slot_end');
  });
  await knex.schema.alterTable('unavailable_slots', (table) => {
    table.dropColumn('time_slot_end');
  });
  await knex.schema.alterTable('reschedule_requests', (table) => {
    table.dropColumn('old_times_end');
    table.dropColumn('new_times_end');
  });
};
