const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./shared/logger');
const { init: initWebSocket } = require('./shared/websocket');

const redis = require('./shared/redis/client');
const knex = require('./shared/database/knex');

async function start() {
  try {
    //  DB 连接必须成功，否则不启动
    await knex.raw('SELECT 1');
    logger.info('[MySQL]  连接成功');

    // Redis 可选
    try {
      await redis.connect();
      logger.info('[Redis]  连接成功');
    } catch (_) {
      logger.warn('[Redis]  未连接，将使用纯 MySQL 模式');
    }

    const server = http.createServer(app);
    initWebSocket(server);

    server.listen(config.port, config.host, () => {
      logger.info(`========================================`);
      logger.info(`    喵掌柜服务已启动  `);
      logger.info(`   地址: http://${config.host}:${config.port}`);
      logger.info(`   环境: ${config.env}`);
      logger.info(`   WebSocket: ws://${config.host}:${config.port}/ws`);
      logger.info(`========================================`);

      // 通知 PM2 进程已就绪
      if (typeof process.send === 'function') {
        process.send('ready');
      }
    });
  } catch (err) {
    logger.error('服务器启动失败:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM，正在关闭...');
  await redis.quit().catch(() => {});
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('收到 SIGINT，正在关闭...');
  await redis.quit().catch(() => {});
  process.exit(0);
});

start();
