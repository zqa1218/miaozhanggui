/**
 * 019: slot_bookings 表高精度闭合时间块 + 双锁机制改造
 * - 新增 start_time / end_time / lock_type 列
 * - 回填旧数据
 * - 保留旧列供后续清理
 */
exports.up = async function (knex) {
  // 1. 新增列
  await knex.schema.alterTable('slot_bookings', (table) => {
    table.time('start_time').nullable().after('booking_date').comment('闭合起始时间');
    table.time('end_time').nullable().after('start_time').comment('闭合结束时间');
    table.enum('lock_type', ['pre_lock', 'hard_lock']).defaultTo('hard_lock').after('end_time').comment('锁定类型');
  });

  // 2. 回填: start_time ← time_slot, end_time ← time_slot_end
  await knex.raw(`
    UPDATE slot_bookings
    SET start_time = TIME_FORMAT(STR_TO_DATE(time_slot, '%H:%i'), '%H:%i'),
        end_time = TIME_FORMAT(
          COALESCE(
            STR_TO_DATE(time_slot_end, '%H:%i'),
            ADDTIME(STR_TO_DATE(time_slot, '%H:%i'), '01:00:00')
          ),
          '%H:%i'
        )
    WHERE start_time IS NULL
  `);

  // 3. 删除旧唯一约束 uq_slot_range (migration 015 创建的)
  //    创建新唯一约束 uq_slot_interval (基于 start_time + end_time)
  try {
    await knex.schema.alterTable('slot_bookings', (table) => {
      table.dropUnique(['m_id', 'studio_id', 'booking_date', 'time_slot', 'time_slot_end'], 'uq_slot_range');
    });
  } catch (_) { /* 约束可能不存在 */ }

  await knex.schema.alterTable('slot_bookings', (table) => {
    table.unique(['m_id', 'studio_id', 'booking_date', 'start_time', 'end_time'], 'uq_slot_interval');
  });

  // 4. 添加索引
  await knex.schema.raw('CREATE INDEX idx_slot_bookings_lock ON slot_bookings(lock_type)');
};

exports.down = async function (knex) {
  // 回滚: 删新唯一约束，恢复旧约束
  await knex.schema.alterTable('slot_bookings', (table) => {
    table.dropUnique(['m_id', 'studio_id', 'booking_date', 'start_time', 'end_time'], 'uq_slot_interval');
  });

  await knex.schema.alterTable('slot_bookings', (table) => {
    table.unique(['m_id', 'studio_id', 'booking_date', 'time_slot', 'time_slot_end'], 'uq_slot_range');
  });

  await knex.schema.raw('DROP INDEX idx_slot_bookings_lock ON slot_bookings');

  // 回滚: 删除新列
  await knex.schema.alterTable('slot_bookings', (table) => {
    table.dropColumn('lock_type');
    table.dropColumn('end_time');
    table.dropColumn('start_time');
  });
};
