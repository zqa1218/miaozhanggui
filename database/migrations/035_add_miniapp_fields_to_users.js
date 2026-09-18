/**
 * 035: users 表新增微信小程序登录字段（只增不删）
 * - wx_mp_open_id     小程序 openid（与网页 wx_open_id 不同）
 * - wx_mp_session_key 最近 session_key（仅用于解密）
 * - last_login_at     最近登录时间
 * - 唯一键 uq_users_wx_mp
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('users', 'wx_mp_open_id'))) {
    await knex.schema.alterTable('users', (t) => {
      t.string('wx_mp_open_id', 64).nullable().after('qq_open_id').comment('微信小程序openid(与网页openid不同)');
    });
  }
  if (!(await knex.schema.hasColumn('users', 'wx_mp_session_key'))) {
    await knex.schema.alterTable('users', (t) => {
      t.string('wx_mp_session_key', 128).nullable().after('wx_mp_open_id').comment('小程序最近session_key');
    });
  }
  if (!(await knex.schema.hasColumn('users', 'last_login_at'))) {
    await knex.schema.alterTable('users', (t) => {
      t.dateTime('last_login_at').nullable().after('wx_mp_session_key').comment('最近登录时间');
    });
  }
  try {
    await knex.raw('ALTER TABLE users ADD UNIQUE KEY uq_users_wx_mp (wx_mp_open_id)');
  } catch (e) {
    if (!/Duplicate key name/i.test(e.message)) throw e;
  }
};

exports.down = async function (knex) {
  try { await knex.raw('ALTER TABLE users DROP INDEX uq_users_wx_mp'); } catch (_) {}
  if (await knex.schema.hasColumn('users', 'last_login_at')) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('last_login_at'));
  }
  if (await knex.schema.hasColumn('users', 'wx_mp_session_key')) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('wx_mp_session_key'));
  }
  if (await knex.schema.hasColumn('users', 'wx_mp_open_id')) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('wx_mp_open_id'));
  }
};
