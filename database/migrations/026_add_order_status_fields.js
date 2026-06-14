/**
 * 026: orders 表新增状态机字段
 * - payment_status: 支付状态
 * - service_status: 服务履约状态
 * - application_status: 用户特殊申请状态
 * - requested_new_time: 改期申请的目标时间段
 */
exports.up = async function (knex) {
  const hasPaymentStatus = await knex.schema.hasColumn('orders', 'payment_status');
  if (!hasPaymentStatus) {
    await knex.schema.alterTable('orders', (table) => {
      table.enum('payment_status', [
        'PENDING_DEPOSIT',   // 待付定金
        'DEPOSIT_PAID',       // 已付定金/待付尾款
        'COMPLETED',          // 已结清
        'REFUNDED',           // 已退款
      ]).defaultTo('PENDING_DEPOSIT').after('status').comment('支付状态');

      table.enum('service_status', [
        'UPCOMING',           // 正常待服务
        'FULFILLED',          // 已完成
        'CANCELLED',          // 已取消
      ]).defaultTo('UPCOMING').after('payment_status').comment('服务履约状态');

      table.enum('application_status', [
        'NONE',               // 无特殊申请
        'RESCHEDULE_REQUESTED', // 改期申请中
        'CANCEL_REQUESTED',    // 取消申请中
      ]).defaultTo('NONE').after('service_status').comment('用户特殊申请状态');

      table.string('requested_new_time', 64).nullable().after('application_status').comment('申请改期的新时间段(如 10:00-11:15)');
    });
  }

  // 回填：根据旧 status 字段推断初始状态
  await knex.raw(`
    UPDATE orders SET
      payment_status = CASE
        WHEN status IN ('待支付') THEN 'PENDING_DEPOSIT'
        WHEN status IN ('已付定金','已确认锁定','尾款待确认') THEN 'DEPOSIT_PAID'
        WHEN status IN ('已结清','已完成拍摄') THEN 'COMPLETED'
        WHEN status IN ('已退款取消') THEN 'REFUNDED'
        ELSE 'PENDING_DEPOSIT'
      END,
      service_status = CASE
        WHEN status IN ('已取消','已退款取消') THEN 'CANCELLED'
        WHEN status IN ('已完成拍摄') THEN 'FULFILLED'
        ELSE 'UPCOMING'
      END,
      application_status = CASE
        WHEN status IN ('退款审核中') THEN 'CANCEL_REQUESTED'
        ELSE 'NONE'
      END
    WHERE payment_status = 'PENDING_DEPOSIT'
  `);
};

exports.down = async function (knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('requested_new_time');
    table.dropColumn('application_status');
    table.dropColumn('service_status');
    table.dropColumn('payment_status');
  });
};
