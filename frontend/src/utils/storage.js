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

const _engine = {
  get(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
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
