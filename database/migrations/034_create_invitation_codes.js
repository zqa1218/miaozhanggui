exports.up = function (knex) {
  return knex.schema.createTable('invitation_codes', (t) => {
    t.bigIncrements('id').primary();
    t.string('code', 16).notNullable().unique().index();
    t.boolean('is_used').notNullable().defaultTo(false);
    t.string('used_by_m_id', 64).nullable().index();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('used_at').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('invitation_codes');
};
