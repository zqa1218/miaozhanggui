-- ============================================================
-- 阶段三增量迁移: 辅助模块表结构
-- 从旧系统 miazhanggui_xyz 完整迁移至 studio_booking
-- ============================================================
USE `studio_booking`;

-- 1. merchants — 商户认证与设置（settings 字段内嵌在此表）
CREATE TABLE IF NOT EXISTS `merchants` (
  `id`              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `m_id`            VARCHAR(64)   NOT NULL UNIQUE           COMMENT '商户唯一ID',
  `username`        VARCHAR(64)   NOT NULL UNIQUE           COMMENT '登录账号',
  `password_hash`   VARCHAR(255)  NOT NULL                  COMMENT 'bcrypt 密码哈希',
  `shop_name`       VARCHAR(128)  NOT NULL                  COMMENT '店铺名称',
  `shop_mode`       ENUM('studio','photographer') DEFAULT 'studio' COMMENT '营业模式',
  `qr_code_url`     VARCHAR(512)                            COMMENT '通用收款码URL',
  `alipay_qr_url`   VARCHAR(512)                            COMMENT '支付宝收款码URL',
  `wechat_qr_url`   VARCHAR(512)                            COMMENT '微信收款码URL',
  `announcement`    TEXT                                    COMMENT '首页公告',
  `created_at`      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商户认证与设置表';

-- 2. notifications — 通知消息
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `m_id`       VARCHAR(64)  NOT NULL                        COMMENT '商户ID',
  `title`      VARCHAR(256) NOT NULL                        COMMENT '通知标题',
  `content`    TEXT                                         COMMENT '通知内容',
  `type`       ENUM('info','success','warning','danger') DEFAULT 'info',
  `order_no`   VARCHAR(32)  DEFAULT NULL                    COMMENT '关联订单号',
  `is_read`    TINYINT(1)   DEFAULT 0                       COMMENT '是否已读',
  `created_at` DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_noti_mid_read`    (`m_id`, `is_read`),
  INDEX `idx_noti_mid_created` (`m_id`, `created_at`),
  INDEX `idx_noti_order_no`    (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知消息表';

-- 3. operation_logs — 商家操作日志
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `m_id`       VARCHAR(64)  NOT NULL                        COMMENT '商户ID',
  `action`     VARCHAR(512) NOT NULL                        COMMENT '操作描述',
  `order_no`   VARCHAR(32)  DEFAULT NULL                    COMMENT '关联订单号',
  `detail`     TEXT                                         COMMENT '操作详情JSON',
  `created_at` DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_log_mid`      (`m_id`),
  INDEX `idx_log_order_no` (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商家操作日志表';

-- 4. schedule_excel_imports — Excel批量导入排期
CREATE TABLE IF NOT EXISTS `schedule_excel_imports` (
  `id`              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `batch_id`        VARCHAR(64)  NOT NULL                   COMMENT '导入批次号',
  `project`         VARCHAR(255) NOT NULL                   COMMENT '项目名称',
  `schedule_date`   DATE         NOT NULL                   COMMENT '排期日期',
  `time_slot_start` TIME         NOT NULL                   COMMENT '开始时间',
  `time_slot_end`   TIME         NOT NULL                   COMMENT '结束时间',
  `contact`         VARCHAR(128) NOT NULL                   COMMENT '联系方式',
  `remarks`         TEXT                                    COMMENT '备注',
  `studio_id`       BIGINT       DEFAULT NULL               COMMENT '关联项目ID',
  `studio_name`     VARCHAR(255) DEFAULT NULL               COMMENT '项目名称冗余',
  `status`          ENUM('pending','processed','failed') DEFAULT 'pending',
  `error_message`   TEXT                                    COMMENT '失败原因',
  `m_id`            VARCHAR(64)  NOT NULL                   COMMENT '商户ID',
  `created_at`      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_excel_batch`            (`batch_id`),
  INDEX `idx_excel_studio`           (`studio_id`),
  INDEX `idx_excel_mid`              (`m_id`),
  INDEX `idx_excel_mid_batch`        (`m_id`, `batch_id`),
  INDEX `idx_excel_date_slot`        (`schedule_date`, `time_slot_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Excel批量导入排期表';
