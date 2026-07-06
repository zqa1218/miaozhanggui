-- 先加缺失的列，否则 login API 查询 merchant_role 会报错
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS is_admin TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS merchant_role ENUM('photographer','makeup_artist','studio_owner') NOT NULL DEFAULT 'photographer';
