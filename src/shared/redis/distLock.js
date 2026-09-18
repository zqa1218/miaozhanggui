/**
 * 分布式锁封装（可降级）
 *
 * 设计原则（依据结构优化计划 §四）：
 *  - Redis 可用 → 增强（SETNX 抢占锁，降低 DB 死锁/重复写）
 *  - Redis 不可用 → 自动回退，绝不因 Redis 宕机抛 5xx，DB 唯一约束/行锁兜底
 *
 * 用法：
 *   const { withLock } = require('../redis/distLock');
 *   const result = await withLock(`lock:order:${orderNo}`, 15000, async () => { ... });
 */
const redis = require('./client');
const logger = require('../logger');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 在分布式锁保护下执行回调
 * @param {string} key    锁键
 * @param {number} ttlMs  锁自动过期时间（毫秒）
 * @param {Function} fn   回调（返回业务结果）
 * @param {object} [opts] { spinMs=50, retries=3 }
 * @returns {Promise<*>} 回调结果
 */
async function withLock(key, ttlMs, fn, opts = {}) {
  const spinMs = opts.spinMs || 50;
  const retries = opts.retries || 3;

  let acquired = false;
  try {
    acquired = (await redis.set(key, '1', 'PX', ttlMs, 'NX')) === 'OK';
  } catch (err) {
    // Redis 不可用 → 降级：不加分布式锁，直接执行，靠 DB 兜底
    logger.debug('[distLock] Redis 不可用，降级执行 %s', key);
    return await fn();
  }

  if (!acquired) {
    // 锁被占用 → 小退避自旋（DB 行锁/唯一约束仍是最终兜底）
    for (let i = 0; i < retries; i++) {
      await sleep(spinMs);
      try {
        acquired = (await redis.set(key, '1', 'PX', ttlMs, 'NX')) === 'OK';
      } catch (_) {
        return await fn();
      }
      if (acquired) break;
    }
    if (!acquired) return await fn();
  }

  try {
    return await fn();
  } finally {
    try { await redis.del(key); } catch (_) { /* 静默 */ }
  }
}

/**
 * 尝试获取锁（非阻塞），返回释放函数；未获取到返回 null
 * 用于「先拿锁再决定是否执行」的场景
 */
async function tryAcquire(key, ttlMs) {
  try {
    const ok = (await redis.set(key, '1', 'PX', ttlMs, 'NX')) === 'OK';
    if (!ok) return null;
    return async function release() {
      try { await redis.del(key); } catch (_) {}
    };
  } catch (_) {
    // Redis 不可用 → 返回一个「空锁」释放函数，行为等价于不加锁
    return async function release() {};
  }
}

module.exports = { withLock, tryAcquire };
