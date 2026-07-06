exports.up = async function (knex) {
  await knex.schema.raw('CREATE INDEX idx_orders_mid_date_status ON orders(m_id, order_date, status)');
  await knex.schema.raw('CREATE INDEX idx_notifications_order_no ON notifications(order_no)');
  await knex.schema.raw('CREATE INDEX idx_slot_bookings_date ON slot_bookings(booking_date)');
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX idx_orders_mid_date_status ON orders');
  await knex.schema.raw('DROP INDEX idx_notifications_order_no ON notifications');
  await knex.schema.raw('DROP INDEX idx_slot_bookings_date ON slot_bookings');
};
