/**
 * 026: merchants 表增加 declaration_enabled / declaration_content 字段 — 弹窗声明
 */
exports.up = async function (knex) {
  const hasEnabled = await knex.schema.hasColumn('merchants', 'declaration_enabled');
  if (!hasEnabled) {
    await knex.schema.alterTable('merchants', (table) => {
      table.boolean('declaration_enabled').notNullable().defaultTo(false).comment('是否开启弹窗声明');
    });
  }
  const hasContent = await knex.schema.hasColumn('merchants', 'declaration_content');
  if (!hasContent) {
    await knex.schema.alterTable('merchants', (table) => {
      table.text('declaration_content').nullable().comment('声明内容（多行带序号）');
    });
  }
};

exports.down = async function (knex) {
  const hasEnabled = await knex.schema.hasColumn('merchants', 'declaration_enabled');
  if (hasEnabled) {
    await knex.schema.alterTable('merchants', (table) => {
      table.dropColumn('declaration_enabled');
    });
  }
  const hasContent = await knex.schema.hasColumn('merchants', 'declaration_content');
  if (hasContent) {
    await knex.schema.alterTable('merchants', (table) => {
      table.dropColumn('declaration_content');
    });
  }
};
