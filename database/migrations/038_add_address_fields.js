/**
 * 038: studios 新增 address_required 开关；orders 新增 address/address_valid 字段
 */
exports.up = async function (knex) {
  // studios 表
  if (await knex.schema.hasTable('studios')) {
    if (!(await knex.schema.hasColumn('studios', 'address_required'))) {
      await knex.schema.alterTable('studios', (table) => {
        table.boolean('address_required').notNullable().defaultTo(false).comment('是否需要用户提供地址');
      });
    }
  }

  // orders 表
  if (await knex.schema.hasTable('orders')) {
    if (!(await knex.schema.hasColumn('orders', 'address'))) {
      await knex.schema.alterTable('orders', (table) => {
        table.string('address', 512).nullable().comment('用户填写地址');
      });
    }
    if (!(await knex.schema.hasColumn('orders', 'address_valid'))) {
      await knex.schema.alterTable('orders', (table) => {
        table.boolean('address_valid').nullable().defaultTo(null).comment('摄影验证地址：null=未验证 true=正确 false=不正确');
      });
    }
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasTable('studios')) {
    if (await knex.schema.hasColumn('studios', 'address_required')) {
      await knex.schema.alterTable('studios', (table) => { table.dropColumn('address_required'); });
    }
  }
  if (await knex.schema.hasTable('orders')) {
    if (await knex.schema.hasColumn('orders', 'address')) {
      await knex.schema.alterTable('orders', (table) => { table.dropColumn('address'); });
    }
    if (await knex.schema.hasColumn('orders', 'address_valid')) {
      await knex.schema.alterTable('orders', (table) => { table.dropColumn('address_valid'); });
    }
  }
};
