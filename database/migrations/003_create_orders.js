exports.up = function (knex) {
  return knex.schema.createTable('orders', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.string('order_no', 32).unique().notNullable().comment('订单号');
    table.string('m_id', 64).notNullable().comment('所属商户');
    table.bigInteger('studio_id').unsigned().notNullable().comment('关联项目ID');
    table.string('studio_title', 256).notNullable().comment('项目名称快照');
    table.string('service_mode', 32).notNullable().comment('服务模式快照');
    table.date('order_date').notNullable().comment('预约日期');
    table.json('time_slots').notNullable().comment('时段数组');
    table.boolean('is_package_order').defaultTo(false).comment('是否包天');
    table.decimal('total_price', 10, 2).notNullable().comment('总价');
    table.decimal('deposit_amount', 10, 2).notNullable().comment('定金金额');
    table.integer('deposit_ratio').notNullable().comment('定金比例快照');
    table.string('contact_info', 512).notNullable().comment('联系方式含备注');
    table.integer('people_count').defaultTo(1).comment('人数');
    table.integer('photo_count').nullable().comment('拍摄张数');
    table.enum('status', [
      '待支付', '已付定金', '尾款待确认',
      '已结清', '已完成拍摄', '已取消',
      '退款审核中', '已退款取消'
    ]).defaultTo('待支付').comment('订单状态');
    table.string('user_device_id', 128).notNullable().comment('用户设备ID');
    table.text('refund_text').nullable().comment('退款账号信息');
    table.string('refund_img_url', 512).nullable().comment('退款收款码图片');
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.dateTime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.index('order_no', 'idx_order_no');
    table.index('m_id', 'idx_order_mid');
    table.index(['m_id', 'order_date'], 'idx_order_mid_date');
    table.index(['m_id', 'status'], 'idx_order_mid_status');
    table.index(['user_device_id', 'm_id'], 'idx_order_device');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('orders');
};
