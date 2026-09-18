/**
 * 039: 订单支付流水 order_payments
 * 每笔订单的定金/尾款支付记录，顾客端确认「定金付了没、尾款结清没」
 */
exports.up = async function (knex) {
  if (await knex.schema.hasTable('order_payments')) return;
  await knex.schema.createTable('order_payments', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('order_id').unsigned().notNullable().comment('关联 orders.id');
    t.string('order_no', 32).notNullable().comment('订单号冗余');
    t.enum('type', ['deposit', 'final']).notNullable().comment('定金/尾款');
    t.decimal('amount', 10, 2).notNullable().comment('金额');
    t.enum('status', ['unpaid', 'pending_confirm', 'paid']).notNullable().defaultTo('pending_confirm').comment('状态');
    t.string('voucher_img_url', 512).nullable().comment('转账凭证图');
    t.string('remark', 512).nullable();
    t.string('confirmed_by', 64).nullable().comment('确认的 m_id');
    t.dateTime('confirmed_at').nullable();
    t.dateTime('created_at').defaultTo(knex.fn.now());
    t.dateTime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    t.index(['order_id', 'type'], 'idx_op_order');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('order_payments');
};
