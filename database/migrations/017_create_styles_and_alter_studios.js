/**
 * 017: 创建 styles 表 + studios 增加样式/时间/城市等新字段
 * 采用非破坏性增量策略 — 旧列全部保留，后续 migration 021 统一清理
 */
exports.up = async function (knex) {
  // 1. 创建 styles 独立样式主表 (幂等)
  if (!(await knex.schema.hasTable('styles'))) {
    await knex.schema.createTable('styles', (table) => {
      table.bigIncrements('id').primary().unsigned();
      table.string('m_id', 64).notNullable().comment('所属商户');
      table.string('style_name', 128).notNullable().comment('样式名称');
      table.string('style_cover_url', 512).nullable().comment('风格示意图');
      table.decimal('single_price', 10, 2).notNullable().comment('单张收费金额');
      table.boolean('has_package').defaultTo(false).comment('是否提供套餐');
      table.decimal('package_price', 10, 2).nullable().comment('套餐收费金额');
      table.dateTime('created_at').defaultTo(knex.fn.now());
      table.dateTime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      table.index('m_id', 'idx_styles_mid');
    });
  }

  // 2. studios 增加新字段（逐个检查避免重复）
  const newColumns = [
    { name: 'city', fn: (t) => t.string('city', 128).nullable().comment('地点城市') },
    { name: 'is_style_enabled', fn: (t) => t.boolean('is_style_enabled').defaultTo(false).comment('是否使用样式功能') },
    { name: 'single_price', fn: (t) => t.decimal('single_price', 10, 2).nullable().comment('项目原生单张收费') },
    { name: 'has_package', fn: (t) => t.boolean('has_package').defaultTo(false).comment('项目原生是否支持套餐') },
    { name: 'base_start_time', fn: (t) => t.time('base_start_time').nullable().comment('基础可接单工作起始时间') },
    { name: 'base_end_time', fn: (t) => t.time('base_end_time').nullable().comment('基础可接单工作结束时间') },
    { name: 'interval_rest_time', fn: (t) => t.integer('interval_rest_time').defaultTo(0).comment('每单间隔休息(分钟)') },
    { name: 'is_experience_enabled', fn: (t) => t.boolean('is_experience_enabled').defaultTo(false).comment('是否开启模特经验') },
    { name: 'novice_single_add_time', fn: (t) => t.integer('novice_single_add_time').defaultTo(0).comment('新人单张加时(分钟)') },
    { name: 'novice_package_add_time', fn: (t) => t.integer('novice_package_add_time').defaultTo(0).comment('新人套餐加时(分钟)') },
    { name: 'single_shot_time', fn: (t) => t.integer('single_shot_time').nullable().comment('单张平均拍摄时间(分钟)') },
    { name: 'package_time', fn: (t) => t.integer('package_time').nullable().comment('套餐标准拍摄时间(分钟)') },
  ];

  for (const col of newColumns) {
    if (!(await knex.schema.hasColumn('studios', col.name))) {
      await knex.schema.alterTable('studios', (t) => col.fn(t));
    }
  }

  // 3. 回填: 将现有 price → single_price
  await knex.raw(`
    UPDATE studios SET single_price = price WHERE single_price IS NULL AND price IS NOT NULL
  `);
};

exports.down = async function (knex) {
  // 回滚: 删除 styles 表
  await knex.schema.dropTableIfExists('styles');

  // 回滚: 删除 studios 新增字段
  const dropCols = ['city', 'is_style_enabled', 'single_price', 'has_package',
    'base_start_time', 'base_end_time', 'interval_rest_time',
    'is_experience_enabled', 'novice_single_add_time', 'novice_package_add_time',
    'single_shot_time', 'package_time'];

  for (const col of dropCols) {
    if (await knex.schema.hasColumn('studios', col)) {
      await knex.schema.alterTable('studios', (t) => t.dropColumn(col));
    }
  }
};
