/**
 * 本地缓存抽象层 (Storage Adapter)
 *
 * 设计目标：严禁在组件内直接使用 localStorage / sessionStorage / window / document。
 * 所有本地持久化操作必须经由本模块。当移植到微信小程序时，
 * 仅需将内部实现替换为 wx.setStorageSync / wx.getStorageSync 等，
 * 对外接口签名和使用方式保持不变。
 */

// ---- 内部实现：浏览器端使用 localStorage ----
// 移植微信小程序时替换为 wx.*Storage* 系列 API

/**
 * 存储不可用时的内存兜底。
 *
 * ⚠ 这是一个**既存缺陷的修复**，不是新功能：
 *   本模块原先直接调用 localStorage 且没有任何保护。而路由的导航守卫
 *   每次跳转都会调 storage.get() 读 token —— 于是只要 localStorage 抛错
 *   （Safari 无痕模式、禁用了 Cookie、沙箱 iframe、企业策略），
 *   守卫就抛异常、导航被中止、**整个应用白屏**。
 *   实测：修复前 /tmp/mz-dist-before 与改造后的产物在同样条件下都渲染空白。
 *
 * 为什么不是单纯 try/catch 吞掉：
 *   吞掉之后 storage.set() 后再 get() 会拿到 null，登录态在同一次会话内就丢了，
 *   用户会看到「刚登录完又被踢回登录页」这种更费解的现象。
 *   内存兜底保证**本次会话内**读写自洽，只是刷新后不再保持 ——
 *   这是能给出的最好降级，且只影响那些本来完全用不了存储的用户。
 *
 * 只能降级、不能沉默：首次触发会打一条 warn，方便排查。
 */
const _memory = new Map();
let _warned = false;

function _storageUnavailable(err) {
  if (!_warned) {
    _warned = true;
    // 只警告一次，避免每次读写都刷屏
    console.warn(
      '[storage] 本地存储不可用，已退化为内存缓存：本次会话内读写正常，刷新后不保留。原因：',
      err && err.message ? err.message : err
    );
  }
}

const _engine = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    } catch (err) {
      _storageUnavailable(err);
      return _memory.has(key) ? _memory.get(key) : null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      _storageUnavailable(err);
      _memory.set(key, value);
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      _storageUnavailable(err);
      _memory.delete(key);
    }
  },

  clear() {
    try {
      localStorage.clear();
    } catch (err) {
      _storageUnavailable(err);
      _memory.clear();
    }
  },
};

// ---- 对外暴露的标准接口 ----

export const storage = {
  /**
   * 读取缓存
   * @param {string} key
   * @param {*} fallback 默认值（key 不存在时返回）
   */
  get(key, fallback = null) {
    const val = _engine.get(key);
    return val !== null ? val : fallback;
  },

  /**
   * 写入缓存
   */
  set(key, value) {
    _engine.set(key, value);
  },

  /**
   * 删除指定缓存
   */
  remove(key) {
    _engine.remove(key);
  },

  /**
   * 清空所有缓存
   */
  clear() {
    _engine.clear();
  },
};

/**
 * 从浏览器地址栏全量扫描提取 query 参数（兼容 Hash / History 模式）
 *
 * 为什么不用 new URLSearchParams(location.search)：
 *   - Vue Router History 模式下，?mId= 在 # 号前，location.search 能取到
 *   - Hash 模式下，?mId=shop_xxx 会出现在 # 号之后，location.search 为空
 *   - 本函数全量正则扫描 window.location.href，无论 ? 在 # 前还是 # 后都能命中
 *
 * @param {string} name 参数名
 * @returns {string|null}
 */
export function getQueryParam(name) {
  const reg = new RegExp('([?|&])' + name + '=([^&?#]*)', 'i')
  const r = window.location.href.match(reg)
  return r ? decodeURIComponent(r[2]) : null
}

export default storage;
