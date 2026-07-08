/**
 * HTTP 请求适配器 (Adapter Pattern)
 *
 * 设计目标：所有网络请求必须经由本模块发出，组件/页面禁止直接 import axios。
 * 当后续移植到微信小程序时，仅需替换此文件的内部实现（改为 wx.request），
 * 对外接口签名保持不变。
 */

import { storage } from './storage'

const BASE_URL = '/api';
const DEFAULT_TIMEOUT = 15000;

/**
 * 动态获取 Auth Token — 每次请求时实时读取，避免缓存过期 Token
 * @param {'admin'|'client'|'none'} tokenType
 */
function getAuthHeaders(tokenType = 'admin') {
  if (tokenType === 'client') {
    const token = storage.get('mzg_client_token', '')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  if (tokenType === 'none') return {}
  // default: admin
  const token = storage.get('mzg_admin_token', '')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * 核心请求方法（Adapter 内部实现）
 */
async function _request({ url, method = 'GET', data = null, params = {}, headers = {}, tokenType = 'admin' }) {
  // 构建完整 URL
  let fullUrl = `${BASE_URL}${url}`;

  // 拼接 query params（安全序列化，避免 [object Object]）
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      // 如果 val 是对象/数组则跳过（防止 param=[object Object]）
      if (typeof val === 'object') return
      searchParams.append(key, val);
    }
  });
  const qs = searchParams.toString();
  if (qs) fullUrl += `?${qs}`;

  // 构建 fetch options — 每次请求动态读取最新 Token
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(tokenType),
      ...headers,
    },
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  // 超时控制
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  options.signal = controller.signal;

  let response;
  try {
    response = await fetch(fullUrl, options);
  } finally {
    clearTimeout(timer);
  }

  // 401 → 清除登录态并重定向到登录页
  if (response.status === 401) {
    if (tokenType === 'client') {
      storage.remove('mzg_client_token')
      storage.remove('mzg_client_user')
      if (!window.location.pathname.startsWith('/admin') && window.location.pathname !== '/login') {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)
      }
    } else {
      storage.remove('mzg_admin_token')
      storage.remove('mzg_admin_mid')
      storage.remove('mzg_admin_shopname')
      if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login'
      }
    }
    return { success: false, code: 'UNAUTHORIZED', message: '请先登录', data: null }
  }

  // 统一解析 JSON
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error((body && body.message) || `请求失败 (${response.status})`);
    error.status = response.status;
    error.code = (body && body.code) || 'HTTP_ERROR';
    error.data = body;
    throw error;
  }

  return body;
}

// ---- 对外暴露的标准接口 ----
// 组件仅能通过以下方法发起请求
// 第三个参数 tokenType: 'admin'（默认）| 'client' | 'none'

export const http = {
  get(url, params = {}, tokenType = 'admin') {
    return _request({ url, method: 'GET', params, tokenType });
  },

  post(url, data = {}, tokenType = 'admin') {
    return _request({ url, method: 'POST', data, tokenType });
  },

  put(url, data = {}, tokenType = 'admin') {
    return _request({ url, method: 'PUT', data, tokenType });
  },

  delete(url, params = {}, tokenType = 'admin') {
    return _request({ url, method: 'DELETE', params, tokenType });
  },
};

export default http;
