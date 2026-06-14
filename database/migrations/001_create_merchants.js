exports.up = function (knex) {
  return knex.schema.createTable('merchants', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.string('m_id', 64).unique().notNullable().comment('商户对外ID');
    table.string('username', 64).unique().notNullable().comment('登录账号');
    table.string('password_hash', 255).notNullable().comment('密码哈希');
    table.string('shop_name', 128).notNullable().comment('店铺名称');
    table.enum('shop_mode', ['studio', 'photographer']).defaultTo('studio').comment('全局营业模式');
    table.string('qr_code_url', 512).nullable().comment('收款码图片地址');
    table.text('announcement').nullable().comment('公告文字');
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.dateTime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.index('m_id', 'idx_m_id');
    table.index('username', 'idx_username');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('merchants');
};
