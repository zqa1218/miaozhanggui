exports.up = async function (knex) {
  await knex.schema.alterTable('schedule_excel_imports', (table) => {
    table.renameColumn('merchant_id', 'm_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('schedule_excel_imports', (table) => {
    table.renameColumn('m_id', 'merchant_id');
  });
};
