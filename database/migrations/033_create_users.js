exports.up = function (knex) {
  return knex.schema.createTable('users', (t) => {
    t.bigIncrements('id').primary();
    t.string('phone', 32).nullable().index();
    t.string('wx_open_id', 128).nullable().unique().index();
    t.string('qq_open_id', 128).nullable().unique().index();
    t.string('union_id', 128).nullable().index();
    t.string('nickname', 64).nullable();
    t.string('avatar', 512).nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('users');
};
