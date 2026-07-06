exports.up = async function (knex) {
  // ─── slot_bookings ───
  // 回填 NULL time_slot_end：默认 time_slot + 1小时
  await knex.raw(`
    UPDATE slot_bookings
    SET time_slot_end = TIME_FORMAT(ADDTIME(STR_TO_DATE(time_slot, '%H:%i'), '01:00:00'), '%H:%i')
    WHERE time_slot_end IS NULL
  `);

  // 删除旧唯一约束
  await knex.schema.alterTable('slot_bookings', (table) => {
    table.dropUnique(['m_id', 'studio_id', 'booking_date', 'time_slot'], 'uq_slot');
  });

  // 创建新唯一约束（含 time_slot_end）
  await knex.schema.alterTable('slot_bookings', (table) => {
    table.unique(['m_id', 'studio_id', 'booking_date', 'time_slot', 'time_slot_end'], 'uq_slot_range');
  });

  // ─── unavailable_slots ───
  await knex.raw(`
    UPDATE unavailable_slots
    SET time_slot_end = TIME_FORMAT(ADDTIME(STR_TO_DATE(time_slot, '%H:%i'), '00:30:00'), '%H:%i')
    WHERE time_slot_end IS NULL
  `);

  await knex.schema.alterTable('unavailable_slots', (table) => {
    table.dropUnique(['m_id', 'studio_id', 'disabled_date', 'time_slot'], 'uq_disabled');
  });

  await knex.schema.alterTable('unavailable_slots', (table) => {
    table.unique(['m_id', 'studio_id', 'disabled_date', 'time_slot', 'time_slot_end'], 'uq_disabled_range');
  });
};

exports.down = async function (knex) {
  // 恢复 slot_bookings 原约束
  await knex.schema.alterTable('slot_bookings', (table) => {
    table.dropUnique(['m_id', 'studio_id', 'booking_date', 'time_slot', 'time_slot_end'], 'uq_slot_range');
  });
  await knex.schema.alterTable('slot_bookings', (table) => {
    table.unique(['m_id', 'studio_id', 'booking_date', 'time_slot'], 'uq_slot');
  });

  // 恢复 unavailable_slots 原约束
  await knex.schema.alterTable('unavailable_slots', (table) => {
    table.dropUnique(['m_id', 'studio_id', 'disabled_date', 'time_slot', 'time_slot_end'], 'uq_disabled_range');
  });
  await knex.schema.alterTable('unavailable_slots', (table) => {
    table.unique(['m_id', 'studio_id', 'disabled_date', 'time_slot'], 'uq_disabled');
  });
};
