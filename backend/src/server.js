const app = require('./app');
const config = require('./config');
const { pool } = require('./config/database');

async function bootstrap() {
  // 验证数据库连接
  try {
    const conn = await pool.getConnection();
    console.log('[DB] 数据库连接验证成功');
    conn.release();
  } catch (err) {
    console.error('[DB] 数据库连接失败:', err.message);
    console.error('[DB] 请确认 MySQL 已启动且 database/init.sql 已执行');
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`[Server] 服务已启动 → http://localhost:${config.port}`);
    console.log(`[Server] 环境: ${config.env}`);
  });
}

bootstrap();
