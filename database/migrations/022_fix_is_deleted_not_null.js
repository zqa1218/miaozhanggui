/**
 * 022: 修复 studios.is_deleted 缺少 NOT NULL 约束
 *
 * 问题: 原始定义为 boolean().defaultTo(false)，未加 NOT NULL。
 *       NULL 行会被 WHERE is_deleted = 0 静默过滤，导致数据"消失"。
 * 修复: 回填 NULL → 0，再追加 NOT NULL 约束。
 */
exports.up = async function (knex) {
  // 1. 回填历史 NULL 值
  await knex.raw('UPDATE studios SET is_deleted = 0 WHERE is_deleted IS NULL');

  // 2. 修改列定义为 NOT NULL DEFAULT 0
  await knex.raw(
    "ALTER TABLE studios MODIFY COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '软删除标记'"
  );
};

exports.down = async function (knex) {
  // 恢复为允许 NULL 的原始定义
  await knex.raw(
    "ALTER TABLE studios MODIFY COLUMN is_deleted TINYINT(1) DEFAULT 0 COMMENT '软删除标记'"
  );
};
