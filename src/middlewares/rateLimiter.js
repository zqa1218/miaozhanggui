/**
 * 内存限流器
 */
function rateLimiter(maxRequests = 10, windowSec = 60) {
  const MAX_STORE_SIZE = 10000;
  const store = new Map();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.start > windowSec * 1000) store.delete(key);
    }
  }, Math.max(windowSec * 1000, 60000));

  if (cleanupTimer.unref) cleanupTimer.unref();

  return (req, res, next) => {
    const key = req.deviceId || req.ip || 'unknown';
    const now = Date.now();

    if (store.size >= MAX_STORE_SIZE) {
      const oldest = [...store.keys()][0];
      if (oldest) store.delete(oldest);
    }

    if (!store.has(key)) {
      store.set(key, { count: 1, start: now });
      return next();
    }

    const entry = store.get(key);
    if (now - entry.start > windowSec * 1000) {
      store.set(key, { count: 1, start: now });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return res.rh.fail('请求太频繁了，请稍后再试', 429);
    }
    next();
  };
}

module.exports = rateLimiter;
