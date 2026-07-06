-- 1. 独立样式通用主表 (独立资产库)
CREATE TABLE `styles` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `m_id` VARCHAR(64) NOT NULL,                        -- 关联商户编码 [cite: 637]
  `style_name` VARCHAR(128) NOT NULL,                  -- 样式/风格名称 [cite: 631]
  `style_cover_url` VARCHAR(512) NULL,                 -- 风格示意图 URL [cite: 631]
  `single_price` DECIMAL(10,2) NOT NULL,               -- 单张拍摄单价(元) [cite: 631]
  `has_package` TINYINT(1) NOT NULL DEFAULT 0,         -- 是否提供套餐计费 [cite: 631]
  `package_price` DECIMAL(10,2) NULL,                  -- 套餐一口价(元) [cite: 632]
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_style_mid` (`m_id`) [cite: 637]
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 核心项目表 (剔除旧计价，整合定价分流开关与变长加时精算器)
CREATE TABLE `studios` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `m_id` VARCHAR(64) NOT NULL,                        -- 所属商户 [cite: 639]
  `title` VARCHAR(256) NOT NULL,                       -- 项目名称 [cite: 632]
  `description` TEXT NULL,                             -- 项目描述 [cite: 686]
  `city` VARCHAR(128) NOT NULL,                        -- 地点城市 (V2必填) [cite: 632]
  `cover_url` VARCHAR(512) NULL,                       -- 封面图 URL [cite: 687]
  `detail_img_urls` JSON NULL,                         -- 详情多图 URL 数组 (JSON) [cite: 687]
  `is_style_enabled` TINYINT(1) NOT NULL DEFAULT 0,   -- 是否使用独立样式功能开关 [cite: 634]
  `single_price` DECIMAL(10,2) NULL,                   -- 原生单张价 (开关关闭时降级替代) [cite: 634]
  `has_package` TINYINT(1) NOT NULL DEFAULT 0,         -- 原生是否支持套餐 [cite: 634]
  `package_price` DECIMAL(10,2) NULL,                  -- 原生套餐价 [cite: 635]
  `base_start_time` TIME NOT NULL DEFAULT '09:00',     -- 每日总接单起始点 (Window_B_Step2) [cite: 633]
  `base_end_time` TIME NOT NULL DEFAULT '21:00',       -- 每日总接单截止点 [cite: 633]
  `interval_rest_time` INT NOT NULL DEFAULT 15,        -- 每单拍摄完后强制转场休息时间(分钟) [cite: 633]
  `is_experience_enabled` TINYINT(1) NOT NULL DEFAULT 0,-- 是否开启模特经验勾选 [cite: 635]
  `novice_single_add_time` INT NOT NULL DEFAULT 0,     -- 新人单张额外加时时间(分钟) [cite: 635]
  `novice_package_add_time` INT NOT NULL DEFAULT 0,    -- 新人套餐额外加时时间(分钟) [cite: 635]
  `single_shot_time` INT NOT NULL DEFAULT 60,          -- 单张服务标准耗时(分钟) [cite: 635]
  `package_time` INT NOT NULL DEFAULT 180,             -- 套餐服务标准耗时(分钟) [cite: 635]
  `deposit_ratio` INT NOT NULL DEFAULT 30,             -- 定金比例 (5/10/30/50/100) [cite: 636]
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,          -- 软删除标记 (强制默认0，防止空值滤除) [cite: 695]
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_studio_mid_deleted` (`m_id`, `is_deleted`) [cite: 695]
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 项目与样式多对多交叉关联表
CREATE TABLE `studio_style_relations` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `studio_id` BIGINT UNSIGNED NOT NULL,
  `style_id` BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY `uq_studio_style` (`studio_id`, `style_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 项目开放日期表 (Window_B_Step1 多选日期打散入库)
CREATE TABLE `studio_availabilities` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `studio_id` BIGINT UNSIGNED NOT NULL,
  `available_date` DATE NOT NULL,
  UNIQUE KEY `uq_studio_date` (`studio_id`, `available_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. 项目每日固定休息/不接单时段表 (Window_B_Step2 动态多段行输入)
CREATE TABLE `studio_rest_slots` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `studio_id` BIGINT UNSIGNED NOT NULL,
  `start_time` TIME NOT NULL,                           -- 休息开始时间 (如 "12:00") [cite: 754]
  `end_time` TIME NOT NULL                              -- 休息结束时间 (如 "13:30") [cite: 755]
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. 高精度闭合时间块排期占用表 (双锁机制核心排他表)
CREATE TABLE `slot_bookings` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `m_id` VARCHAR(64) NOT NULL,                        -- 商户对外 ID [cite: 649]
  `studio_id` BIGINT UNSIGNED NOT NULL,                -- 关联项目 ID [cite: 649]
  `order_no` VARCHAR(64) NOT NULL,                     -- 关联订单号 [cite: 649]
  `booking_date` DATE NOT NULL,                        -- 预约具体公历日期 [cite: 649]
  `start_time` TIME NOT NULL,                           -- 闭合时间轴精算起始点 [cite: 649]
  `end_time` TIME NOT NULL,                             -- 包含拍摄加时和整理转场后的绝对终点 [cite: 650]
  `lock_type` ENUM('pre_lock', 'hard_lock') NOT NULL,   -- 锁状态: pre_lock(用户定金预锁), hard_lock(摄影师接单硬锁) [cite: 650]
  INDEX `idx_slot_lookup` (`m_id`, `studio_id`, `booking_date`),
  INDEX `idx_slot_order` (`order_no`) [cite: 718]
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. 订单主表
CREATE TABLE `orders` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_no` VARCHAR(64) UNIQUE NOT NULL,              -- 订单号 ord_{timestamp}_{random} [cite: 701]
  `m_id` VARCHAR(64) NOT NULL,                        -- 所属商户 [cite: 701]
  `studio_id` BIGINT UNSIGNED NOT NULL,                -- 关联项目ID [cite: 702]
  `style_id` BIGINT UNSIGNED NULL,                    -- 选定样式ID (非启用样式时留空) [cite: 710]
  `opt_type` ENUM('single', 'package') NOT NULL,       -- 预约服务服务类型 [cite: 710]
  `photo_count` INT NOT NULL DEFAULT 1,                -- 拍摄张数 [cite: 706]
  `people_count` INT NOT NULL DEFAULT 1,                -- 人数 [cite: 706]
  `model_experience` ENUM('newcomer', 'veteran') NULL, -- 模特经验 [cite: 711]
  `role_name` VARCHAR(256) NOT NULL,                    -- 二次元 COS/特定角色名称 (强制必填) [cite: 711]
  `contact_note` VARCHAR(512) NOT NULL,                 -- 联系人方式及特殊备注 [cite: 711]
  `total_price` DECIMAL(10,2) NOT NULL,                -- 总价 [cite: 704]
  `deposit_amount` DECIMAL(10,2) NOT NULL,             -- 定金金额 [cite: 705]
  `status` VARCHAR(32) NOT NULL DEFAULT '待支付',        -- 统一中文状态：待支付/已付定金/尾款待确认/已结清/已完成拍摄/退款审核中/已取消 [cite: 707]
  `user_device_id` VARCHAR(128) NOT NULL,               -- C端设备特征追踪码 [cite: 707]
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_order_lookup` (`m_id`, `status`) [cite: 713]
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;