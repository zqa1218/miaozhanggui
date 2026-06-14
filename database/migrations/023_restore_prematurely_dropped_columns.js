/**
 * 023: 还原 Migration 021 过早删除的列
 *
 * Migration 021 删除 studios/orders/slot_bookings 的旧列时，
 * 代码中仍有 18+ 处引用这些列（写入和读取），导致全站 500 崩溃。
 * 此迁移还原所有被删除的列，待代码彻底迁移完毕后再执行清理。
 */
exports.up = async function (knex) {
  // ─── studios: 还原旧列 ───
  const studioCols = [
    { name: 'service_mode',       fn: (t) => t.enum('service_mode', ['studio', 'photographer']).defaultTo('studio').comment('服务模式') },
    { name: 'calc_mode',          fn: (t) => t.enum('calc_mode', ['time', 'photo', 'photo_time']).defaultTo('time').comment('计费方式') },
    { name: 'is_holiday_price',   fn: (t) => t.boolean('is_holiday_price').defaultTo(false).comment('节假日不同价') },
    { name: 'price',              fn: (t) => t.decimal('price', 10, 2).nullable().comment('统一价') },
    { name: 'weekday_price',      fn: (t) => t.decimal('weekday_price', 10, 2).nullable().comment('工作日价') },
    { name: 'holiday_price',      fn: (t) => t.decimal('holiday_price', 10, 2).nullable().comment('节假日价') },
    { name: 'is_package_day',     fn: (t) => t.boolean('is_package_day').defaultTo(false).comment('支持包天') },
    { name: 'has_discount',       fn: (t) => t.boolean('has_discount').defaultTo(false).comment('多时段折扣') },
    { name: 'discount_rules',     fn: (t) => t.json('discount_rules').nullable().comment('折扣规则') },
    { name: 'min_photos',         fn: (t) => t.integer('min_photos').defaultTo(1).comment('起订张数') },
    { name: 'slot_max_photos',    fn: (t) => t.integer('slot_max_photos').defaultTo(20).comment('每时段最大张数') },
    { name: 'extra_person_fee',   fn: (t) => t.decimal('extra_person_fee', 10, 2).defaultTo(0).comment('额外每人费用') },
    { name: 'is_field_photo',     fn: (t) => t.boolean('is_field_photo').defaultTo(false).comment('场照接单') },
    { name: 'field_photo_dates',  fn: (t) => t.json('field_photo_dates').nullable().comment('场照日期') },
    { name: 'custom_remark_label',fn: (t) => t.string('custom_remark_label', 64).defaultTo('备注').comment('自定义备注标签') },
    { name: 'open_time',          fn: (t) => t.time('open_time').defaultTo('09:00:00').comment('营业开始') },
    { name: 'close_time',         fn: (t) => t.time('close_time').defaultTo('21:00:00').comment('营业结束') },
    { name: 'time_interval',      fn: (t) => t.integer('time_interval').defaultTo(60).comment('排期间隔(分)') },
  ];

  for (const col of studioCols) {
    if (!(await knex.schema.hasColumn('studios', col.name))) {
      await knex.schema.alterTable('studios', (t) => col.fn(t));
    }
  }

  // ─── orders: 还原旧列 ───
  const orderCols = [
    { name: 'studio_title',    fn: (t) => t.string('studio_title', 256).nullable().comment('项目名称快照').after('studio_id') },
    { name: 'service_mode',    fn: (t) => t.string('service_mode', 32).nullable().comment('服务模式快照').after('studio_title') },
    { name: 'time_slots',      fn: (t) => t.json('time_slots').nullable().comment('时段数组').after('order_date') },
    { name: 'time_slots_end',  fn: (t) => t.json('time_slots_end').nullable().comment('时段结束数组').after('time_slots') },
    { name: 'is_package_order',fn: (t) => t.boolean('is_package_order').defaultTo(false).comment('是否包天').after('time_slots_end') },
    { name: 'people_count',    fn: (t) => t.integer('people_count').defaultTo(1).comment('人数') },
    { name: 'contact_info',    fn: (t) => t.string('contact_info', 512).nullable().comment('联系方式').after('people_count') },
  ];

  for (const col of orderCols) {
    if (!(await knex.schema.hasColumn('orders', col.name))) {
      await knex.schema.alterTable('orders', (t) => col.fn(t));
    }
  }

  // ─── slot_bookings: 还原旧列 ───
  const slotCols = [
    { name: 'time_slot',       fn: (t) => t.string('time_slot', 8).nullable().comment('时段 HH:MM').after('booking_date') },
    { name: 'time_slot_end',   fn: (t) => t.string('time_slot_end', 8).nullable().comment('时段结束').after('time_slot') },
    { name: 'is_package_day',  fn: (t) => t.boolean('is_package_day').defaultTo(false).comment('是否包天').after('time_slot_end') },
    { name: 'booking_count',   fn: (t) => t.integer('booking_count').defaultTo(1).comment('占用数').after('is_package_day') },
  ];

  for (const col of slotCols) {
    if (!(await knex.schema.hasColumn('slot_bookings', col.name))) {
      await knex.schema.alterTable('slot_bookings', (t) => col.fn(t));
    }
  }
};

exports.down = async function (knex) {
  // 回滚: 再次删除旧列（仅当代码确认不再引用时使用）
  const studioDrop = ['service_mode','calc_mode','is_holiday_price','price','weekday_price',
    'holiday_price','is_package_day','has_discount','discount_rules','min_photos',
    'slot_max_photos','extra_person_fee','is_field_photo','field_photo_dates',
    'custom_remark_label','open_time','close_time','time_interval'];
  for (const col of studioDrop) {
    if (await knex.schema.hasColumn('studios', col)) {
      await knex.schema.alterTable('studios', (t) => t.dropColumn(col));
    }
  }

  const orderDrop = ['studio_title','service_mode','time_slots','time_slots_end',
    'is_package_order','people_count','contact_info'];
  for (const col of orderDrop) {
    if (await knex.schema.hasColumn('orders', col)) {
      await knex.schema.alterTable('orders', (t) => t.dropColumn(col));
    }
  }

  const slotDrop = ['time_slot','time_slot_end','is_package_day','booking_count'];
  for (const col of slotDrop) {
    if (await knex.schema.hasColumn('slot_bookings', col)) {
      await knex.schema.alterTable('slot_bookings', (t) => t.dropColumn(col));
    }
  }
};
