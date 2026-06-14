exports.up = function (knex) {
  return knex.schema.createTable('studios', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.string('m_id', 64).notNullable().comment('所属商户');
    table.string('title', 256).notNullable().comment('项目名称');
    table.text('description').nullable().comment('项目描述');
    table.string('cover_url', 512).nullable().comment('封面图地址');
    table.json('detail_img_urls').nullable().comment('详情图URL数组');
    table.enum('service_mode', ['studio', 'photographer']).notNullable().comment('服务模式');
    table.enum('calc_mode', ['time', 'photo', 'photo_time'])
      .notNullable().defaultTo('time').comment('计费方式');
    table.boolean('is_holiday_price').defaultTo(false).comment('节假日不同价');
    table.decimal('price', 10, 2).nullable().comment('统一价');
    table.decimal('weekday_price', 10, 2).nullable().comment('工作日价');
    table.decimal('holiday_price', 10, 2).nullable().comment('节假日价');
    table.boolean('is_package_day').defaultTo(false).comment('是否支持包天');
    table.decimal('package_price', 10, 2).nullable().comment('包天价格');
    table.boolean('has_discount').defaultTo(false).comment('开启多时段折扣');
    table.json('discount_rules').nullable().comment('折扣规则 [{hours,price}]');
    table.integer('deposit_ratio').defaultTo(30).comment('定金比例');
    table.time('open_time').defaultTo('09:00:00').comment('营业开始');
    table.time('close_time').defaultTo('21:00:00').comment('营业结束');
    table.integer('time_interval').defaultTo(60).comment('排期间隔分钟');
    table.integer('min_photos').defaultTo(1).comment('起订张数');
    table.integer('slot_max_photos').defaultTo(20).comment('每时段最大张数');
    table.decimal('extra_person_fee', 10, 2).defaultTo(0).comment('额外每人费用');
    table.boolean('is_field_photo').defaultTo(false).comment('场照接单');
    table.json('field_photo_dates').nullable().comment('场照日期数组');
    table.string('custom_remark_label', 64).defaultTo('备注').comment('自定义备注标签');
    table.boolean('is_deleted').defaultTo(false).comment('软删除');
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.dateTime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.index(['m_id'], 'idx_studio_m_id');
    table.index(['m_id', 'is_deleted'], 'idx_studio_m_id_deleted');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('studios');
};
