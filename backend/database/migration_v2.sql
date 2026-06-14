-- ============================================================
-- 阶段二 Schema 迁移: 双锁引擎 + 耗时规则
-- 执行方式: mysql -u root -p studio_booking < database/migration_v2.sql
-- ============================================================

-- 1. studios — 新增耗时规则字段
ALTER TABLE `studios`
  ADD COLUMN `single_duration_minutes`        INT UNSIGNED DEFAULT 60   COMMENT '单张拍摄耗时（分钟）' AFTER `package_details`,
  ADD COLUMN `package_session_duration_minutes` INT UNSIGNED DEFAULT 60 COMMENT '套餐单次拍摄耗时（分钟）' AFTER `single_duration_minutes`,
  ADD COLUMN `rest_interval_minutes`           INT UNSIGNED DEFAULT 15  COMMENT '拍摄间间隔休息（分钟）' AFTER `package_session_duration_minutes`,
  ADD COLUMN `new_customer_extra_minutes`      INT UNSIGNED DEFAULT 0   COMMENT '新人额外耗时（分钟）'   AFTER `rest_interval_minutes`;

-- 2. orders — 新增定金字段 + 扩展状态枚举
ALTER TABLE `orders`
  ADD COLUMN `deposit_amount` DECIMAL(10,2)                           COMMENT '定金金额（元）' AFTER `total_amount`,
  MODIFY COLUMN `status` ENUM('pending','pre_paid','confirmed','completed','cancelled','expired')
    NOT NULL DEFAULT 'pending'                                        COMMENT '订单状态: pending=待支付 pre_paid=已付定金 confirmed=已确认 completed=已完成 cancelled=已取消 expired=已过期';

-- 3. slot_bookings — 替换状态枚举为双锁语义
--    pre_lock = 用户付定金锁（临时占位，15分钟过期）
--    hard_lock = 摄影师确认锁（不可自动释放）
ALTER TABLE `slot_bookings`
  MODIFY COLUMN `status` ENUM('pre_lock','hard_lock','completed','cancelled')
    NOT NULL DEFAULT 'pre_lock'                                       COMMENT '时段状态: pre_lock=定金锁 hard_lock=确认锁 completed=已完成 cancelled=已取消';

-- 4. 更新测试数据: 给已有 studio 补全耗时规则
UPDATE `studios` SET
  single_duration_minutes        = 60,
  package_session_duration_minutes = 45,
  rest_interval_minutes          = 10,
  new_customer_extra_minutes     = 15
WHERE id = 1;

UPDATE `studios` SET
  single_duration_minutes        = 30,
  rest_interval_minutes          = 5,
  new_customer_extra_minutes     = 0
WHERE id = 2;
