/**
 * 041: 项目级「预约时间模式」+ 订单 Excel 快速导入所需列
 *
 * time_mode:
 *   time_axis  — 连续时间轴（默认，现有行为：顾客自由拖选起止时间）
 *   fixed_slot — 固定档位（营业时间按 slot_duration 切档，一档 = 一单）
 *
 * orders 侧新增三列，用于承载新版 Excel 导入：
 *   customer_name   — 顾客昵称/CN。此前没有这列，role_name 一直兼当顾客名；
 *                     新模板里「角色名称」和「顾客cn」是两列，必须分开存。
 *   order_source    — 区分线上自助下单与 Excel 导入，导入单要放行商家直接取消。
 *   import_batch_id — 批次号，便于回溯/将来做整批撤销。
 *
 * 注意：不修改 orders.status 的现有 enum。线上 enum 比迁移文件多
 * 「定金待确认」「未结清」两个值（历史裸 SQL 改的），MODIFY 有丢值风险。
 * 导入终态用到的「已付定金」与 payment_status 的 DEPOSIT_PAID 都已存在。
 */
exports.up = async function (knex) {
  // ─── studios ───
  if (!(await knex.schema.hasColumn('studios', 'time_mode'))) {
    await knex.schema.alterTable('studios', (t) => {
      t.enum('time_mode', ['time_axis', 'fixed_slot'])
        .notNullable()
        .defaultTo('time_axis')
        .comment('预约时间模式: time_axis=连续时间轴(默认), fixed_slot=固定档位');
    });
  }
  if (!(await knex.schema.hasColumn('studios', 'slot_duration'))) {
    await knex.schema.alterTable('studios', (t) => {
      t.integer('slot_duration')
        .nullable()
        .defaultTo(30)
        .comment('固定档位时长(分钟), 仅 time_mode=fixed_slot 生效, 一档=一单');
    });
  }

  // ─── orders ───
  if (!(await knex.schema.hasColumn('orders', 'customer_name'))) {
    await knex.schema.alterTable('orders', (t) => {
      t.string('customer_name', 256)
        .nullable()
        .comment('顾客昵称/CN (role_name 仍为角色名称)');
    });
  }
  if (!(await knex.schema.hasColumn('orders', 'order_source'))) {
    await knex.schema.alterTable('orders', (t) => {
      // NOT NULL + 默认值会把存量订单一次性回填为 online
      t.enum('order_source', ['online', 'import'])
        .notNullable()
        .defaultTo('online')
        .comment('订单来源: online=线上自助下单, import=Excel 快速导入');
    });
  }
  if (!(await knex.schema.hasColumn('orders', 'import_batch_id'))) {
    await knex.schema.alterTable('orders', (t) => {
      t.string('import_batch_id', 64)
        .nullable()
        .comment('Excel 导入批次号, 同一次导入共用');
    });
  }
};

exports.down = async function (knex) {
  const cols = [
    ['orders', 'import_batch_id'],
    ['orders', 'order_source'],
    ['orders', 'customer_name'],
    ['studios', 'slot_duration'],
    ['studios', 'time_mode'],
  ];
  for (const [table, name] of cols) {
    if (await knex.schema.hasColumn(table, name)) {
      await knex.schema.alterTable(table, (t) => t.dropColumn(name));
    }
  }
};
