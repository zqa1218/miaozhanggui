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

/**
 * 主题配置 —— **全部主题相关差异的唯一来源**。
 *
 * 加第三套主题只需要在这里加一项 + 在 tokens.semantic.css 里加一个
 * `:root[data-theme="xxx"]` 覆盖块。组件里没有任何 `if (theme === 'glass')`
 * 这样的分支：主题之间的视觉差异全部由 CSS 变量吸收，组件只认 key。
 *
 * 字段说明：
 *   key   写进 data-theme 与 localStorage 的值
 *   label 显示名
 *   desc  一句话描述（切换器里给用户看）
 *   hint  无障碍描述，读屏用；比 desc 更明确地说出「选了会怎样」
 */
export const THEME_CONFIG = [
  {
    key: 'classic',
    label: '经典',
    desc: '暖杏色 · 日系磨砂，原有的界面',
    hint: '切换到经典界面：暖杏色，中度磨砂',
  },
  {
    key: 'glass',
    label: '玻璃',
    desc: '蓝白色 · 冷调通透，玻璃质感',
    hint: '切换到玻璃界面：蓝白色，冷调玻璃质感',
  },
]

export const DEFAULT_THEME_KEY = THEME_CONFIG[0].key

/** 全部合法主题键。切换器 UI 遍历 THEME_CONFIG，这里只给校验用。 */
export const THEMES = THEME_CONFIG.map((t) => t.key)

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
let current = queryOverride || readStored() || readAttribute() || DEFAULT_THEME_KEY

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
 * 是否应该禁用过渡动画。
 * 两处都要看：用户在系统里要求减少动效（前庭敏感），
 * 以及浏览器是否支持 View Transitions（不支持就直接切，不做任何补偿动画）。
 */
function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch (e) {
    return false
  }
}

/**
 * 执行主题切换，可用时套一层 View Transition 做整页交叉淡入。
 *
 * 三条硬性要求：
 *   1. **必须特征检测**。不支持的浏览器直接瞬时切换 ——
 *      注意是「瞬时」，不是「先变白再淡入」。View Transition 的默认行为
 *      就是旧快照淡出、新快照淡入，两侧同时存在，中间不会露出白底；
 *      自己写动画反而容易写出白闪。
 *   2. prefers-reduced-motion 下完全不调用 startViewTransition，
 *      而不是把时长调到 0 —— 后者仍会创建快照层，可能引起一次合成抖动。
 *   3. startViewTransition 的回调是同步 DOM 变更；异步操作不能放进去
 *      （放了会让快照在变更前就拍完）。
 */
function commit(theme) {
  const mutate = () => {
    current = theme
    applyToDom(theme)
  }

  const canTransition =
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function' &&
    !prefersReducedMotion()

  if (canTransition) {
    // 若上一次过渡还没结束，startViewTransition 会先把它 skip 掉，不会叠加
    document.startViewTransition(mutate)
  } else {
    mutate()
  }
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

  const from = current
  commit(theme)

  // 查询参数覆盖期间不落盘：否则 QA 点一次链接就改掉了访客的长期偏好
  if (!queryOverride) writeStored(theme)

  notify(theme)
  emitThemeSwitch(from, theme)
  return current
}

/**
 * 恢复默认：清掉存储的偏好并回到默认主题。
 *
 * 语义是「我放弃之前的选择」而不是「切到经典」—— 前者会连同
 * localStorage 一起清掉，后者只是切一次主题、偏好仍然记着。
 * 切换器里给的是前者，所以两者必须是两个不同的动作。
 *
 * 注意：本项目**没有**「跟随系统」这个选项。首版曾评估过，
 * 结论是商家后台不应随系统深浅色变化（那是收钱工具，不该某天打开变个样），
 * 详见交付说明。所以这里的「重置」语义是「恢复默认」而非「跟随系统」。
 */
export function resetTheme() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    /* 存储不可用：下面照样把主题切回默认 */
  }
  if (current === DEFAULT_THEME_KEY) return current

  // 不能在这里调 setTheme：它会因为「主题确实变了」而把默认值写回存储，
  // 于是「清掉偏好」这个语义就丢了 —— 存储里会留下 'classic'。
  // 恢复默认之后应当**没有**存储项，这样将来默认值若改变，这些用户会跟着变。
  const from = current
  commit(DEFAULT_THEME_KEY)
  notify(DEFAULT_THEME_KEY)
  emitThemeSwitch(from, DEFAULT_THEME_KEY)
  return current
}

/**
 * 切换事件的对外广播。
 *
 * 项目**目前没有任何分析/埋点方案**（已确认：无 gtag / 百度统计 / Sentry，
 * api/log.js 那个 /logs 是商家操作日志，写进去会污染商家的操作记录）。
 * 所以这里不调用任何上报接口，只派发一个 DOM 事件 ——
 * 将来接入分析工具时，在入口处订阅它即可，不必回来改这个文件：
 *
 *   window.addEventListener('theme:switch', (e) => {
 *     analytics.track('theme_switch', e.detail)   // { from, to }
 *   })
 */
function emitThemeSwitch(from, to) {
  try {
    window.dispatchEvent(
      new CustomEvent('theme:switch', { detail: { from, to } })
    )
  } catch (e) {
    /* 自定义事件不被支持时静默 —— 埋点是增强，不该影响切换 */
  }
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
 * 读取某个主题的**真实令牌值**，供切换器渲染迷你预览。
 *
 * 为什么这么做而不是把色值抄进 THEME_CONFIG：
 *   抄进配置的色值会在令牌调整后过期，而且不会有任何机制提醒你 ——
 *   预览会安静地展示一个已经不存在的主题。这里改成临时把 data-theme
 *   切过去、从 computed style 里读，读完立刻恢复。令牌改了预览自动跟着变。
 *
 * 为什么不会闪：
 *   这一整段在同一个 JS 任务里跑完，浏览器不可能在中间插一次绘制 ——
 *   样式重算是同步的（getComputedStyle 会强制重算），绘制不是。
 *
 * @param {string} theme
 * @returns {{ bg: string, surface: string, border: string, brand: string, text: string }}
 */
export function readThemeTokens(theme) {
  const EMPTY = { bg: '', surface: '', border: '', brand: '', text: '' }
  if (!isValid(theme)) return EMPTY
  try {
    const el = document.documentElement
    const prev = el.getAttribute('data-theme')
    el.setAttribute('data-theme', theme)
    const cs = getComputedStyle(el)
    const read = (n) => cs.getPropertyValue(n).trim()
    const out = {
      bg: read('--bg-base'),
      surface: read('--surface-glass-strong'),
      border: read('--border-color'),
      brand: read('--color-primary'),
      text: read('--text-1'),
    }
    if (prev === null) el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', prev)
    return out
  } catch (e) {
    return EMPTY
  }
}

/**
 * Vue 组合式封装 —— 组件里请用这个，不要直接用上面几个函数。
 * 它负责订阅与自动解绑，避免每个组件重复写 onUnmounted。
 *
 * @returns {{
 *   theme: import('vue').Ref<string>,
 *   setTheme: (t: string) => void,
 *   config: typeof THEME_CONFIG,
 *   forced: boolean,
 * }}
 */
export function useTheme() {
  const theme = ref(current)
  const unsubscribe = subscribe((next) => {
    theme.value = next
  })
  // 在组件 / 作用域销毁时自动退订
  onScopeDispose(unsubscribe, true)
  return { theme, setTheme, config: THEME_CONFIG, forced: isThemeForced() }
}
