/**
 * 037: orders 表固化 user_id（线上已裸 SQL 加过）+ 幂等键
 * - user_id           下单顾客 users.id（幂等，已存在则跳过）
 * - idempotency_key   幂等键（小程序下单防重复）
 * - 唯一键 uq_orders_idem / 组合索引 idx_orders_user_status
 */
exports.up = async function (knex) {
  const hasUserId = await knex.schema.hasColumn('orders', 'user_id');
  if (!hasUserId) {
    await knex.schema.alterTable('orders', (t) => {
      t.bigInteger('user_id').unsigned().nullable().comment('下单顾客 users.id');
    });
    try {
      await knex.raw('ALTER TABLE orders ADD KEY idx_user_id (user_id)');
    } catch (e) {
      if (!/Duplicate key name/i.test(e.message)) throw e;
    }
  }

  if (!(await knex.schema.hasColumn('orders', 'idempotency_key'))) {
    await knex.schema.alterTable('orders', (t) => {
      t.string('idempotency_key', 64).nullable().comment('幂等键(小程序下单防重复)');
    });
  }
  try {
    await knex.raw('ALTER TABLE orders ADD UNIQUE KEY uq_orders_idem (idempotency_key)');
  } catch (e) {
    if (!/Duplicate key name/i.test(e.message)) throw e;
  }
  try {
    await knex.raw('ALTER TABLE orders ADD KEY idx_orders_user_status (user_id, status, created_at)');
  } catch (e) {
    if (!/Duplicate key name/i.test(e.message)) throw e;
  }
};

exports.down = async function (knex) {
  try { await knex.raw('ALTER TABLE orders DROP INDEX idx_orders_user_status'); } catch (_) {}
  try { await knex.raw('ALTER TABLE orders DROP INDEX uq_orders_idem'); } catch (_) {}
  if (await knex.schema.hasColumn('orders', 'idempotency_key')) {
    await knex.schema.alterTable('orders', (t) => t.dropColumn('idempotency_key'));
  }
  // 注意：user_id 线上原本已存在，回滚不删除，避免破坏既有功能
};
