const Redis = require('ioredis');
const config = require('../../config');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  retryStrategy: (times) => {
    if (times > 10) return null; // 放弃重连
    return Math.min(times * 200, 3000);
  },
  lazyConnect: true,
  // Redis 不可用时快速失败（不排队、不阻塞业务），由调用方降级到 MySQL/内存
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
});

redis.on('connect', () => console.log('[Redis]  连接成功'));
redis.on('error', (err) => console.error('[Redis]  连接错误:', err.message));

//   暴露单例
module.exports = redis;

//   导出独立的 getClient 方便测试
module.exports.getClient = () => redis;
