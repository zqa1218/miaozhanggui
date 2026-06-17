-- ============================================================
-- 阶段五迁移: 扩展商户角色体系
-- 新增 妆娘(makeup_artist) 和明确 摄影(photographer) 角色
-- shop_mode: studio / photographer / makeup_artist
-- ============================================================
USE `studio_booking`;

-- 1. 扩展 merchants.shop_mode 枚举值
ALTER TABLE `merchants`
  MODIFY COLUMN `shop_mode` ENUM('studio','photographer','makeup_artist') NOT NULL DEFAULT 'studio'
  COMMENT '营业模式: studio=棚主 photographer=摄影 makeup_artist=妆娘';

-- 2. 为旧数据 photographer -> 'studio' 做兜底
-- UPDATE `merchants` SET `shop_mode` = 'studio' WHERE `shop_mode` = 'photographer';

-- 3. 新增 role_display_name 虚拟列（可选，方便查）
-- ALTER TABLE `merchants` ADD COLUMN `role_name` VARCHAR(32) GENERATED ALWAYS AS (
--   CASE shop_mode
--     WHEN 'studio' THEN '棚主'
--     WHEN 'photographer' THEN '摄影'
--     WHEN 'makeup_artist' THEN '妆娘'
--   END
-- ) VIRTUAL;
