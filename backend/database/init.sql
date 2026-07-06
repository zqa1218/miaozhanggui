-- ============================================================
-- 全栈接单预约系统 — 数据库初始化 DDL
-- 引擎: MySQL 8.0+ / InnoDB
-- 编码: utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS `studio_booking` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `studio_booking`;

-- ============================================================
-- 1. styles — 独立通用样式资产表
-- 存放可复用的风格/样式模板，供项目（studio）关联引用
-- ============================================================
CREATE TABLE `styles` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(100)  NOT NULL            COMMENT '样式名称',
  `description` TEXT                              COMMENT '样式描述',
  `cover_url`   VARCHAR(500)                      COMMENT '封面图URL',
  `preview_urls` JSON                             COMMENT '预览图URL数组 ["url1","url2"]',
  `status`      TINYINT       NOT NULL DEFAULT 1  COMMENT '状态: 0=禁用 1=启用',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_styles_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='独立通用样式资产表';

-- ============================================================
-- 2. studios — 项目主表
-- 核心业务实体，含样式开关 & 条件单张/套餐定价字段
-- pricing_model: single=仅单张, package=仅套餐, both=两者皆有
-- 当 pricing_model 为 single 或 both 时 single_price 必填
-- 当 pricing_model 为 package 或 both 时 package_* 字段必填
-- ============================================================
CREATE TABLE `studios` (
  `id`                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`                  VARCHAR(200)  NOT NULL            COMMENT '项目名称',
  `description`           TEXT                              COMMENT '项目描述',
  `cover_url`             VARCHAR(500)                      COMMENT '封面图URL',
  `detail_urls`           JSON                              COMMENT '详情图URL数组',
  `is_style_enabled`      TINYINT(1)    NOT NULL DEFAULT 0  COMMENT '样式开关: 0=关闭 1=开启',
  `pricing_model`         ENUM('single','package','both')
                                      NOT NULL DEFAULT 'single'
                                                            COMMENT '定价模式',
  `single_price`          DECIMAL(10,2)                     COMMENT '单张价格（元），pricing_model含single时必填',
  `package_price`         DECIMAL(10,2)                     COMMENT '套餐总价（元），pricing_model含package时必填',
  `package_session_count` INT UNSIGNED                      COMMENT '套餐包含次数',
  `package_details`       JSON                              COMMENT '套餐扩展详情 {"valid_days":365,"description":"..."}',
  `status`                TINYINT       NOT NULL DEFAULT 1  COMMENT '状态: 0=下架 1=上架',
  `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_studios_status` (`status`),
  INDEX `idx_studios_pricing_model` (`pricing_model`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目主表';

-- ============================================================
-- 3. studio_style_relations — 项目与样式多对多交叉关联表
-- 仅在 studio.is_style_enabled = 1 时此关联生效
-- ============================================================
CREATE TABLE `studio_style_relations` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `studio_id`  INT UNSIGNED NOT NULL                    COMMENT '项目ID',
  `style_id`   INT UNSIGNED NOT NULL                    COMMENT '样式ID',
  `sort_order` INT          NOT NULL DEFAULT 0          COMMENT '排序权重，越小越靠前',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_studio_style` (`studio_id`, `style_id`),
  CONSTRAINT `fk_ssr_studio` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ssr_style`  FOREIGN KEY (`style_id`)  REFERENCES `styles`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目-样式多对多关联表';

-- ============================================================
-- 4a. studio_availabilities — 项目开放日期表
-- 定义项目在哪些日期的哪些时段可预约
-- 同一 studio 同一天只能有一条记录
-- ============================================================
CREATE TABLE `studio_availabilities` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `studio_id`  INT UNSIGNED NOT NULL                    COMMENT '项目ID',
  `date`       DATE         NOT NULL                    COMMENT '开放日期',
  `start_time` TIME         NOT NULL                    COMMENT '当日开始营业时间',
  `end_time`   TIME         NOT NULL                    COMMENT '当日结束营业时间',
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1          COMMENT '是否生效: 0=否 1=是',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_avail_studio_date` (`studio_id`, `date`),
  CONSTRAINT `fk_avail_studio` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目开放日期表';

-- ============================================================
-- 4b. studio_rest_slots — 每日固定休息段表
-- 在开放日的时间范围内，定义固定的不可预约时段（午休、设备维护等）
-- 支持两种模式：
--   A) 关联到具体 availability_id → 仅该日生效
--   B) day_of_week 非空 → 周期性生效（每周固定休息段）
-- ============================================================
CREATE TABLE `studio_rest_slots` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `studio_id`       INT UNSIGNED NOT NULL               COMMENT '项目ID',
  `availability_id` INT UNSIGNED                        COMMENT '关联的具体开放日记录（NULL=周期性规则）',
  `day_of_week`     TINYINT                              COMMENT '周期规则: 0=周日 1=周一 ... 6=周六（NULL=非周期）',
  `start_time`      TIME         NOT NULL               COMMENT '休息开始时间',
  `end_time`        TIME         NOT NULL               COMMENT '休息结束时间',
  `reason`          VARCHAR(200)                         COMMENT '休息原因（午休/设备维护等）',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_rest_studio_date` (`studio_id`, `availability_id`),
  INDEX `idx_rest_studio_dow`  (`studio_id`, `day_of_week`),
  CONSTRAINT `fk_rest_studio`      FOREIGN KEY (`studio_id`)       REFERENCES `studios`(`id`)               ON DELETE CASCADE,
  CONSTRAINT `fk_rest_avail`       FOREIGN KEY (`availability_id`) REFERENCES `studio_availabilities`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日固定休息段表';

-- ============================================================
-- 5. orders — 预约订单主表
-- ============================================================
CREATE TABLE `orders` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_no`     VARCHAR(32)  NOT NULL                  COMMENT '订单编号（全局唯一）',
  `studio_id`    INT UNSIGNED NOT NULL                  COMMENT '项目ID',
  `user_id`      INT UNSIGNED                           COMMENT '用户ID（后续对接用户体系）',
  `user_name`    VARCHAR(100) NOT NULL                  COMMENT '预约人姓名',
  `user_phone`   VARCHAR(20)  NOT NULL                  COMMENT '预约人手机号',
  `pricing_type` ENUM('single','package')
                               NOT NULL                 COMMENT '定价类型',
  `total_amount` DECIMAL(10,2) NOT NULL                 COMMENT '订单总金额（元）',
  `status`       ENUM('pending','confirmed','completed','cancelled','expired')
                               NOT NULL DEFAULT 'pending'
                                                        COMMENT '订单状态',
  `remark`       TEXT                                   COMMENT '用户备注',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_order_no` (`order_no`),
  INDEX `idx_orders_studio`   (`studio_id`),
  INDEX `idx_orders_user`     (`user_id`),
  INDEX `idx_orders_status`   (`status`),
  INDEX `idx_orders_created`  (`created_at`),
  CONSTRAINT `fk_order_studio` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预约订单主表';

-- ============================================================
-- 6. slot_bookings — 高精度连续时间块双锁核心表
--
-- 【双锁机制说明】
-- 1. 乐观锁 (lock_version):
--    用于已确认时段的数据一致性。更新时 WHERE lock_version = :old_version
--    并 SET lock_version = lock_version + 1，防止并发覆盖。
--    当 status='confirmed' 后，此字段为主要并发控制手段。
--
-- 2. 悲观锁/临时占位锁 (locked_at / lock_expires_at):
--    用于用户发起预约时的临时占位。写入时设置 locked_at 和 lock_expires_at
--    （通常为 15 分钟过期）。其他用户在查询可用时段时，需排除 status='locked'
--    且 lock_expires_at > NOW() 的记录。
--    确认后 status 变为 confirmed 并清除 locked_at/lock_expires_at；
--    超时未确认的记录可被定时任务清理（status → cancelled）。
--
-- 【重叠检测约束】
-- 同一 studio 同一天同一时段只能有一条非取消记录，由业务层保证
-- （使用 SELECT ... FOR UPDATE + 重叠条件判断）。
-- ============================================================
CREATE TABLE `slot_bookings` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id`        INT UNSIGNED NOT NULL               COMMENT '关联订单ID',
  `studio_id`       INT UNSIGNED NOT NULL               COMMENT '项目ID（冗余，加速查询）',
  `booking_date`    DATE         NOT NULL               COMMENT '预约日期',
  `start_time`      TIME         NOT NULL               COMMENT '预约开始时间',
  `end_time`        TIME         NOT NULL               COMMENT '预约结束时间',
  `status`          ENUM('locked','confirmed','completed','cancelled')
                                  NOT NULL DEFAULT 'locked'
                                                        COMMENT '时段状态',
  `lock_version`    INT UNSIGNED NOT NULL DEFAULT 0     COMMENT '乐观锁版本号',
  `locked_at`       DATETIME                            COMMENT '临时锁定时间',
  `lock_expires_at` DATETIME                            COMMENT '临时锁过期时间（默认锁定后15分钟）',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- 外键
  CONSTRAINT `fk_slot_order`  FOREIGN KEY (`order_id`)  REFERENCES `orders`(`id`)  ON DELETE CASCADE,
  CONSTRAINT `fk_slot_studio` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE RESTRICT,

  -- 索引
  INDEX `idx_slot_studio_date`       (`studio_id`, `booking_date`),
  INDEX `idx_slot_status_expires`    (`status`, `lock_expires_at`),
  INDEX `idx_slot_order`             (`order_id`),
  -- 复合索引：加速按日期+状态查询（排除 cancelled 后的可用时段查询）
  INDEX `idx_slot_date_status`       (`booking_date`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='高精度连续时间块双锁核心表';

-- ============================================================
-- 初始化测试数据（可选）
-- ============================================================

-- 插入示例样式
INSERT INTO `styles` (`name`, `description`, `cover_url`, `preview_urls`) VALUES
('清新自然风', '自然光线下的清新人像风格', '/assets/styles/fresh/cover.jpg', '["/assets/styles/fresh/1.jpg","/assets/styles/fresh/2.jpg"]'),
('复古胶片风', '复古胶片质感的人像风格', '/assets/styles/vintage/cover.jpg', '["/assets/styles/vintage/1.jpg","/assets/styles/vintage/2.jpg"]'),
('时尚杂志风', '高对比度的时尚大片风格', '/assets/styles/fashion/cover.jpg', '["/assets/styles/fashion/1.jpg","/assets/styles/fashion/2.jpg"]');

-- 插入示例项目
INSERT INTO `studios` (`name`, `description`, `is_style_enabled`, `pricing_model`, `single_price`, `package_price`, `package_session_count`, `package_details`) VALUES
('时光摄影工作室', '提供专业人像写真服务', 1, 'both', 299.00, 799.00, 3, '{"valid_days": 365, "description": "三组造型，精修9张"}'),
('简约映像馆', '专注简约风格证件照与轻写真', 0, 'single', 99.00, NULL, NULL, NULL);

-- 关联项目与样式
INSERT INTO `studio_style_relations` (`studio_id`, `style_id`, `sort_order`) VALUES
(1, 1, 1),
(1, 2, 2),
(1, 3, 3);
