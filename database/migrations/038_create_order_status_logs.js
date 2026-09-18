/**
 * 038: 订单状态时间线 order_status_logs
 * 顾客端查询状态轨迹 + 商户审计共用
 */
exports.up = async function (knex) {
  if (await knex.schema.hasTable('order_status_logs')) return;
  await knex.schema.createTable('order_status_logs', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('order_id').unsigned().notNullable().comment('关联 orders.id');
    t.string('order_no', 32).notNullable().comment('订单号冗余');
    t.string('from_status', 32).nullable().comment('原状态');
    t.string('to_status', 32).notNullable().comment('新状态');
    t.enum('actor_type', ['system', 'merchant', 'customer']).notNullable().defaultTo('system').comment('操作方');
    t.string('actor_m_id', 64).nullable().comment('操作商户(管理端)');
    t.bigInteger('actor_user_id').unsigned().nullable().comment('操作顾客');
    t.string('remark', 512).nullable().comment('备注');
    t.dateTime('created_at').defaultTo(knex.fn.now());
    t.index(['order_id', 'created_at'], 'idx_osl_order');
    t.index('order_no', 'idx_osl_no');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('order_status_logs');
};
