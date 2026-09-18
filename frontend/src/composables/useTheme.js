/**
 * 主题 API —— 全站唯一的主题读写入口。
 *
 * 为什么要有这个文件：
 *   主题状态最终落在 <html data-theme> 上，但「谁有权改它」必须只有一个地方。
 *   如果每个组件各自 document.documentElement.setAttribute(...) + 各自读写
 *   localStorage，key 名、取值校验、查询参数优先级会迅速发散，
 *   而这类 bug 只在特定入口路径下复现，极难排查。
 *
 * 三条约定：
 *   1. 只有本文件写 document.documentElement 的 data-theme 与 localStorage。
 *   2. 取值优先级：?theme= 查询参数 > localStorage > 默认 classic。
 *      查询参数是**只读覆盖**——用于 QA 与分享链接，永不写入存储，
 *      否则点一次带参数的链接就会把访客的偏好永久改掉。
 *   3. 任何存储访问都可能抛错（隐私模式 / 禁用 Cookie / 沙箱 iframe），
 *      全部 try/catch 兜底；失败时退到 classic，绝不让主题问题影响可用性。
 *
 * 与 index.html 内联脚本的关系：
 *   内联脚本负责「首屏不闪烁」，它在任何 CSS 之前同步执行；
 *   本模块负责「运行时切换」。两者的取值规则必须保持一致（见上）。
 */

import { ref, onScopeDispose } from 'vue'

const STORAGE_KEY = 'mzg_theme'
const DEFAULT_THEME = 'classic'

/** 全部合法主题。切换器 UI 直接遍历它，避免在各处硬编码选项。 */
export const THEMES = ['classic', 'glass']

const isValid = (t) => THEMES.indexOf(t) !== -1

/**
 * 读取查询参数里的主题覆盖。
 * 正则与 index.html 内联脚本中的保持一致，改动需同步两处。
 */
function readQueryOverride() {
  try {
    const m = /[?&]theme=(classic|glass)(?:&|$)/.exec(window.location.search)
    return m ? m[1] : null
  } catch (e) {
    return null
  }
}

function readStored() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return isValid(saved) ? saved : null
  } catch (e) {
    return null
  }
}

function writeStored(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch (e) {
    /* 存储不可用：本次会话内主题仍然生效，只是不持久化 */
  }
}

function readAttribute() {
  try {
    const t = document.documentElement.getAttribute('data-theme')
    return isValid(t) ? t : null
  } catch (e) {
    return null
  }
}

function applyToDom(theme) {
  try {
    // 显式写入（包括 classic），而不是「classic 就删属性」——
    // CSS 里 :root 与 :root[data-theme="classic"] 本来就等价，
    // 显式写能让 devtools 一眼看出当前主题，也便于切换器读状态。
    document.documentElement.setAttribute('data-theme', theme)
  } catch (e) {
    /* 忽略 */
  }
}

/* ── 模块级状态（单例） ── */
const queryOverride = readQueryOverride() // 只解析一次，查询参数在会话内不变
let current = queryOverride || readStored() || readAttribute() || DEFAULT_THEME

const listeners = new Set()

function notify(theme) {
  listeners.forEach((fn) => {
    try {
      fn(theme)
    } catch (e) {
      // 单个订阅者出错不应中断其余订阅者
      console.error('[useTheme] 订阅回调抛出异常：', e)
    }
  })
}

/** 当前生效的主题。 */
export function getTheme() {
  return current
}

/** 查询参数是否正在强制覆盖主题（切换器可据此提示「本次会话被 URL 固定」）。 */
export function isThemeForced() {
  return queryOverride !== null
}

/**
 * 切换主题。
 * @param {'classic'|'glass'} theme
 * @returns {string} 生效后的主题（非法入参时返回当前值，不抛错）
 */
export function setTheme(theme) {
  if (!isValid(theme)) {
    console.warn(`[useTheme] 未知主题 "${theme}"，已忽略。合法值：${THEMES.join(' / ')}`)
    return current
  }
  if (theme === current) return current

  current = theme
  applyToDom(theme)
  // 查询参数覆盖期间不落盘：否则 QA 点一次链接就改掉了访客的长期偏好
  if (!queryOverride) writeStored(theme)
  notify(theme)
  return current
}

/**
 * 订阅主题变化。
 * @param {(theme: string) => void} fn
 * @returns {() => void} 取消订阅
 */
export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {}
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/* ── 跨标签页同步 ──
   后台经常被开在两个标签页里。A 页切了主题、B 页不变，
   会让人以为切换器坏了。storage 事件只在**其他**标签页触发，天然不会回环。 */
try {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    if (queryOverride) return // 本页被 URL 固定，忽略外部变化
    if (!isValid(e.newValue) || e.newValue === current) return
    current = e.newValue
    applyToDom(current)
    notify(current)
  })
} catch (e) {
  /* 非浏览器环境或事件注册被拦：忽略 */
}

/**
 * Vue 组合式封装 —— 组件里请用这个，不要直接用上面三个函数。
 * 它负责订阅与自动解绑，避免每个组件重复写 onUnmounted。
 *
 * @returns {{ theme: import('vue').Ref<string>, setTheme: (t: string) => void, themes: string[], forced: boolean }}
 */
export function useTheme() {
  const theme = ref(current)
  const unsubscribe = subscribe((next) => {
    theme.value = next
  })
  // 在组件 / effectScope 销毁时自动退订
  onScopeDispose(unsubscribe, true)
  return { theme, setTheme, themes: THEMES, forced: isThemeForced() }
}
