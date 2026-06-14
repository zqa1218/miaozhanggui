/**
 * 排期Excel导入记录表
 * 用于存储用户通过Excel批量导入的排期数据
 */
exports.up = async function (knex) {
  await knex.schema.createTable('schedule_excel_imports', (table) => {
    table.bigIncrements('id').primary().comment('主键ID');
    
    // === 批次信息 ===
    table.string('batch_id', 64).notNullable().index()
      .comment('导入批次号，一次Excel上传为一个批次');

    // === Excel 内填写字段 ===
    table.string('project', 255).notNullable()
      .comment('项目名称');
    table.date('schedule_date').notNullable()
      .comment('日期（年/月/日）');
    table.time('time_slot_start').notNullable()
      .comment('开始时间（小时:分钟）');
    table.time('time_slot_end').notNullable()
      .comment('结束时间（小时:分钟）');
    table.string('contact', 128).notNullable()
      .comment('联系方式');
    table.text('remarks').nullable()
      .comment('备注');

    // === 关联字段（可选，用于关联已有业务表）===
    table.bigInteger('studio_id').nullable().index()
      .comment('关联项目表ID（匹配后回填）');
    table.string('studio_name', 255).nullable()
      .comment('项目名称冗余（便于展示）');

    // === 状态 ===
    table.enum('status', ['pending', 'processed', 'failed'])
      .notNullable().defaultTo('pending')
      .comment('处理状态：pending=待处理 processed=已处理 failed=失败');
    table.text('error_message').nullable()
      .comment('处理失败原因');

    // === 审计字段 ===
    table.bigInteger('merchant_id').notNullable().index()
      .comment('导入商家ID');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // === 复合索引 ===
    table.index(['merchant_id', 'batch_id']);
    table.index(['schedule_date', 'time_slot_start']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('schedule_excel_imports');
};
