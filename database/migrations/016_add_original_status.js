exports.up = async function (knex) {
  // orders: 记录退款前原始状态
  await knex.schema.alterTable('orders', (table) => {
    table.string('original_status', 32).nullable().comment('退款前原始状态，拒绝退款时恢复');
  });

  // operation_logs: 关联订单号 + 操作详情
  await knex.schema.alterTable('operation_logs', (table) => {
    table.string('order_no', 32).nullable().comment('关联订单号');
    table.text('detail').nullable().comment('操作详情JSON');
    table.index('order_no', 'idx_log_order_no');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('original_status');
  });
  await knex.schema.alterTable('operation_logs', (table) => {
    table.dropIndex('order_no', 'idx_log_order_no');
    table.dropColumn('order_no');
    table.dropColumn('detail');
  });
};
