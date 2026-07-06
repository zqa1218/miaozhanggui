/**
 *   一键初始化数据库脚本
 *   用法: node scripts/init-db.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function init() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
  });

  const dbName = process.env.MYSQL_DATABASE || 'miaozhanggui';

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log(`  数据库 "${dbName}" 已就绪`);

  await connection.end();

  //   执行迁移
  const { execSync } = require('child_process');
  console.log('  正在执行数据库迁移...');
  execSync('npx knex migrate:latest', { stdio: 'inherit' });
  console.log('  数据库初始化完成！');
}

init().catch(console.error);
