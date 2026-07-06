exports.up = async function (knex) {
  await knex.schema.createTable('schedule_excel_imports', (table) => {
    table.bigIncrements('id').primary().comment('主键ID');
    table.string('batch_id', 64).notNullable().index().comment('导入批次号');
    table.string('project', 255).notNullable().comment('项目名称');
    table.date('schedule_date').notNullable().comment('日期');
    table.time('time_slot_start').notNullable().comment('开始时间');
    table.time('time_slot_end').notNullable().comment('结束时间');
    table.string('contact', 128).notNullable().comment('联系方式');
    table.text('remarks').nullable().comment('备注');
    table.bigInteger('studio_id').nullable().index().comment('关联项目ID');
    table.string('studio_name', 255).nullable().comment('项目名称冗余');
    table.enum('status', ['pending', 'processed', 'failed']).notNullable().defaultTo('pending').comment('处理状态');
    table.text('error_message').nullable().comment('失败原因');
    table.string('merchant_id', 64).notNullable().index().comment('商家ID');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['merchant_id', 'batch_id']);
    table.index(['schedule_date', 'time_slot_start']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('schedule_excel_imports');
};
