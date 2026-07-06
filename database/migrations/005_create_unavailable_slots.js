exports.up = function (knex) {
  return knex.schema.createTable('unavailable_slots', (table) => {
    table.bigIncrements('id').primary().unsigned();
    table.string('m_id', 64).notNullable();
    table.bigInteger('studio_id').unsigned().notNullable();
    table.date('disabled_date').notNullable();
    table.string('time_slot', 8).notNullable().comment('HH:MM 半小时粒度');
    table.dateTime('created_at').defaultTo(knex.fn.now());
    table.unique(['m_id', 'studio_id', 'disabled_date', 'time_slot'], 'uq_disabled');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('unavailable_slots');
};
