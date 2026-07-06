-- ============================================================
-- 阶段四增量迁移: 联系方式 & 备注
-- 执行方式: mysql -u root -p studio_booking < database/migration_v4_contact_remark.sql
-- ============================================================
USE `studio_booking`;

ALTER TABLE `studios`
  ADD COLUMN `contact_phone`  VARCHAR(32)  COMMENT '联系电话' AFTER `new_customer_extra_minutes`,
  ADD COLUMN `contact_wechat` VARCHAR(64)  COMMENT '联系微信' AFTER `contact_phone`,
  ADD COLUMN `remark`         TEXT         COMMENT '内部备注' AFTER `contact_wechat`;
