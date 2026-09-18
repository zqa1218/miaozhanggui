/**
 * 036: 顾客登录渠道归一表 user_oauth_accounts
 * 网页/公众号/小程序/QQ 登录都落一行，不再往 users 无限加 openid 列
 */
exports.up = async function (knex) {
  if (await knex.schema.hasTable('user_oauth_accounts')) return;
  await knex.schema.createTable('user_oauth_accounts', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('user_id').unsigned().notNullable().comment('关联 users.id');
    t.enum('provider', ['wechat_website', 'wechat_miniapp', 'qq']).notNullable().comment('登录渠道');
    t.string('open_id', 128).notNullable().comment('该渠道 openid');
    t.string('union_id', 128).nullable().comment('开放平台 unionid');
    t.json('meta').nullable().comment('session_key 等原始信息');
    t.dateTime('created_at').defaultTo(knex.fn.now());
    t.dateTime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    t.unique(['provider', 'open_id'], 'uq_oauth_provider_open');
    t.index('user_id', 'idx_oauth_user');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('user_oauth_accounts');
};
