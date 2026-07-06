/**
 * 021: 删除旧系统废弃列 (仅在 Phase 1-3 验证稳定后执行)
 *
 * studios: 删除旧计价/排期/张数相关列
 * orders: 删除 studio_title, service_mode, time_slots, time_slots_end,
 *          is_package_order, people_count, contact_info
 * slot_bookings: 删除 time_slot, time_slot_end, is_package_day, booking_count
 */
exports.up = async function (knex) {
  // ─── studios ───
  await knex.schema.alterTable('studios', (table) => {
    table.dropColumn('service_mode');
    table.dropColumn('calc_mode');
    table.dropColumn('is_holiday_price');
    table.dropColumn('price');
    table.dropColumn('weekday_price');
    table.dropColumn('holiday_price');
    table.dropColumn('is_package_day');
    table.dropColumn('has_discount');
    table.dropColumn('discount_rules');
    table.dropColumn('min_photos');
    table.dropColumn('slot_max_photos');
    table.dropColumn('extra_person_fee');
    table.dropColumn('is_field_photo');
    table.dropColumn('field_photo_dates');
    table.dropColumn('custom_remark_label');
    table.dropColumn('open_time');
    table.dropColumn('close_time');
    table.dropColumn('time_interval');
  });

  // ─── orders ───
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('studio_title');
    table.dropColumn('service_mode');
    table.dropColumn('time_slots');
    table.dropColumn('time_slots_end');
    table.dropColumn('is_package_order');
    table.dropColumn('people_count');
    table.dropColumn('contact_info');
  });

  // ─── slot_bookings ───
  await knex.schema.alterTable('slot_bookings', (table) => {
    table.dropColumn('time_slot');
    table.dropColumn('time_slot_end');
    table.dropColumn('is_package_day');
    table.dropColumn('booking_count');
  });
};

exports.down = async function (knex) {
  // 回滚: 恢复所有旧列 (不恢复数据)
  await knex.schema.alterTable('studios', (table) => {
    table.enum('service_mode', ['studio', 'photographer']).defaultTo('studio');
    table.enum('calc_mode', ['time', 'photo', 'photo_time']).defaultTo('time');
    table.boolean('is_holiday_price').defaultTo(false);
    table.decimal('price', 10, 2).nullable();
    table.decimal('weekday_price', 10, 2).nullable();
    table.decimal('holiday_price', 10, 2).nullable();
    table.boolean('is_package_day').defaultTo(false);
    table.boolean('has_discount').defaultTo(false);
    table.json('discount_rules').nullable();
    table.integer('min_photos').defaultTo(1);
    table.integer('slot_max_photos').defaultTo(20);
    table.decimal('extra_person_fee', 10, 2).defaultTo(0);
    table.boolean('is_field_photo').defaultTo(false);
    table.json('field_photo_dates').nullable();
    table.string('custom_remark_label', 64).defaultTo('备注');
    table.time('open_time').defaultTo('09:00:00');
    table.time('close_time').defaultTo('21:00:00');
    table.integer('time_interval').defaultTo(60);
  });

  await knex.schema.alterTable('orders', (table) => {
    table.string('studio_title', 256);
    table.string('service_mode', 32);
    table.json('time_slots');
    table.json('time_slots_end');
    table.boolean('is_package_order').defaultTo(false);
    table.integer('people_count').defaultTo(1);
    table.string('contact_info', 512);
  });

  await knex.schema.alterTable('slot_bookings', (table) => {
    table.string('time_slot', 8);
    table.string('time_slot_end', 8);
    table.boolean('is_package_day').defaultTo(false);
    table.integer('booking_count').defaultTo(1);
  });
};
