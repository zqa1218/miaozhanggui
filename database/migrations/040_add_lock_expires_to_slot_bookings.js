/**
 * 040: slot_bookings 新增 pre_lock 过期辅助列 + 索引
 * - lock_expires_at     pre_lock 过期时间，到点可被定时任务清理
 * - 组合索引 idx_slot_studio_date
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('slot_bookings', 'lock_expires_at'))) {
    await knex.schema.alterTable('slot_bookings', (t) => {
      t.dateTime('lock_expires_at').nullable().after('lock_type').comment('pre_lock 过期时间;到点未转 hard_lock 可被清理');
    });
  }
  try {
    await knex.raw('ALTER TABLE slot_bookings ADD KEY idx_slot_studio_date (studio_id, booking_date, lock_type)');
  } catch (e) {
    if (!/Duplicate key name/i.test(e.message)) throw e;
  }
};

exports.down = async function (knex) {
  try { await knex.raw('ALTER TABLE slot_bookings DROP INDEX idx_slot_studio_date'); } catch (_) {}
  if (await knex.schema.hasColumn('slot_bookings', 'lock_expires_at')) {
    await knex.schema.alterTable('slot_bookings', (t) => t.dropColumn('lock_expires_at'));
  }
};
