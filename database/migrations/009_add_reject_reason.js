exports.up = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.text('reject_reason').nullable().comment('管理员拒绝退款原因');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.dropColumn('reject_reason');
  });
};
