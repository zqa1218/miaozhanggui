const mysql = require('mysql2/promise');
const config = require('./index');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.connectionLimit,
  timezone: config.db.timezone,
  dateStrings: true, // 保持 DATE/DATETIME 以字符串形式返回，避免时区转换
});

pool.on('connection', () => {
  console.log('[DB] 新连接已建立');
});

pool.on('error', (err) => {
  console.error('[DB] 连接池错误:', err.message);
});

/**
 * 获取事务连接
 * @returns {Promise<mysql.PoolConnection>}
 */
async function getConnection() {
  return pool.getConnection();
}

module.exports = { pool, getConnection };
