const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./shared/logger');
const { init: initWebSocket } = require('./shared/websocket');

//   启动时预热 Redis（可选）
const redis = require('./shared/redis/client');

async function start() {
  try {
    //   尝试连接 Redis（非阻塞，失败也不影响）
    await redis.connect().catch(() => {
      logger.warn('[Redis]  未连接，将使用纯 MySQL 模式');
    });

    // 使用 http.createServer 以支持 WebSocket
    const server = http.createServer(app);
    initWebSocket(server);

    server.listen(config.port, config.host, () => {
      logger.info(`========================================`);
      logger.info(`    喵掌柜服务已启动  `);
      logger.info(`   地址: http://${config.host}:${config.port}`);
      logger.info(`   环境: ${config.env}`);
      logger.info(`   WebSocket: ws://${config.host}:${config.port}/ws`);
      logger.info(`========================================`);
    });
  } catch (err) {
    logger.error('服务器启动失败:', err);
    process.exit(1);
  }
}

//   优雅关闭
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
