/**
 * 020: orders 表 v2 改造
 * - 新增 style_id / opt_type / model_experience / role_name / contact_note
 * - status ENUM 新增 '已确认锁定'
 * - 保留旧列供后续清理
 */
exports.up = async function (knex) {
  // 1. 新增列
  await knex.schema.alterTable('orders', (table) => {
    table.bigInteger('style_id').unsigned().nullable().after('studio_id').comment('关联样式ID(可空)');
    table.enum('opt_type', ['single', 'package']).defaultTo('single').after('style_id').comment('预约服务类型');
    table.string('model_experience', 32).nullable().after('opt_type').comment('模特经验');
    table.string('role_name', 256).nullable().after('model_experience').comment('拍摄角色名称');
    table.string('contact_note', 512).nullable().after('role_name').comment('联系方式及备注');
    // booking_start_time / booking_end_time 用于高精度闭合时间
    table.time('booking_start_time').nullable().after('order_date').comment('预约起始时间');
    table.time('booking_end_time').nullable().after('booking_start_time').comment('预约结束时间');
  });

  // 2. 修改 status ENUM: 新增 '已确认锁定'
  await knex.raw(`
    ALTER TABLE orders
    MODIFY COLUMN status ENUM(
      '待支付','已付定金','已确认锁定',
      '尾款待确认','已结清','已完成拍摄',
      '已取消','退款审核中','已退款取消'
    ) DEFAULT '待支付'
  `);

  // 3. 回填: opt_type ← is_package_order
  await knex.raw(`
    UPDATE orders SET opt_type = CASE WHEN is_package_order = 1 THEN 'package' ELSE 'single' END
    WHERE opt_type = 'single'
  `);

  // 4. 回填: booking_start_time / booking_end_time ← time_slots
  await knex.raw(`
    UPDATE orders
    SET booking_start_time = TIME_FORMAT(
      STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(time_slots, '$[0]')), '%H:%i'),
      '%H:%i'
    )
    WHERE time_slots IS NOT NULL AND JSON_LENGTH(time_slots) > 0
  `);

  // 5. 添加索引
  await knex.schema.raw('CREATE INDEX idx_orders_style ON orders(style_id)');
};

exports.down = async function (knex) {
  // 回滚: 恢复 status ENUM
  await knex.raw(`
    ALTER TABLE orders
    MODIFY COLUMN status ENUM(
      '待支付','已付定金','尾款待确认',
      '已结清','已完成拍摄','已取消',
      '退款审核中','已退款取消'
    ) DEFAULT '待支付'
  `);

  await knex.schema.raw('DROP INDEX idx_orders_style ON orders');

  // 回滚: 删除新列
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('style_id');
    table.dropColumn('opt_type');
    table.dropColumn('model_experience');
    table.dropColumn('role_name');
    table.dropColumn('contact_note');
    table.dropColumn('booking_start_time');
    table.dropColumn('booking_end_time');
  });
};
