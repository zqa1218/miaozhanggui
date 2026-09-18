/**
 * 降级状态（`<html data-fx="reduced">`）的运行时维护
 *
 * 首帧的判定在 index.html 的内联脚本里做 —— 必须早于任何绘制，
 * 否则「先按满效果渲染、再突然变素」的闪烁比不降级更糟。
 *
 * 本模块负责**之后**的变化：用户在系统设置里切换「减少动态效果」或
 * 「增强对比度」时，页面应当立即跟随，而不是要用户刷新。
 *
 * 启发式判定在两处各写了一遍（内联脚本与本文件），这是有意为之：
 * 内联脚本不能 import 模块（那样就不是同步执行了），
 * 而本模块需要在媒体查询变化后重新评估。**改判定条件时两处都要改。**
 */
import { ref, onScopeDispose } from 'vue'

const ATTR = 'data-fx'
const ON = 'reduced'

/**
 * 低端设备**启发式**判定。
 *
 * 这是启发式，不是精确判定：
 *   · `deviceMemory` 只有 Chromium 系实现，Firefox / Safari 上恒为 undefined，
 *     此时只剩 CPU 逻辑核数这一个信号
 *   · `hardwareConcurrency` 反映逻辑核数，不等于实际算力
 *     （被限频的 8 核机器会漏判；大小核架构下也不准）
 *
 * 之所以敢用：这里**只做减负不做禁用**。判错的代价是「好设备少了一点模糊」，
 * 而不是「差设备直接崩」。方向选错代价小，前提才成立。
 */
function isLowEndDevice() {
  try {
    const cores = navigator.hardwareConcurrency
    const mem = navigator.deviceMemory
    return (
      (typeof cores === 'number' && cores > 0 && cores <= 4) ||
      (typeof mem === 'number' && mem > 0 && mem <= 4)
    )
  } catch (e) {
    return false
  }
}

function prefersMedia(query) {
  try {
    return window.matchMedia(query).matches
  } catch (e) {
    return false
  }
}

/**
 * 查询参数覆盖（?fx=full|reduced）。
 * 与 ?theme= 同构：给 QA 与视觉回归用，不写入任何存储。
 * 存在时**完全接管**判定，媒体查询变化也不再重新计算 ——
 * 否则测试跑到一半系统偏好变了，基线就对不上了。
 */
function readOverride() {
  try {
    const v = document.documentElement.getAttribute('data-fx-override')
    return v === 'full' || v === 'reduced' ? v : null
  } catch (e) {
    return null
  }
}

function computeFx() {
  const ov = readOverride()
  if (ov) return ov === 'reduced'
  return (
    prefersMedia('(prefers-reduced-motion: reduce)') ||
    prefersMedia('(prefers-contrast: more)') ||
    isLowEndDevice()
  )
}

function apply(on) {
  try {
    if (on) document.documentElement.setAttribute(ATTR, ON)
    else document.documentElement.removeAttribute(ATTR)
  } catch (e) {
    /* 忽略 */
  }
}

function makeQuery(query, onChange) {
  try {
    const mq = window.matchMedia(query)
    // addEventListener 在旧版 Safari 上不存在，用回调式兜底
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else if (mq.addListener) mq.addListener(onChange)
    return mq
  } catch (e) {
    return null
  }
}

/** 当前是否处于降级状态（读 DOM，不重复计算 —— 内联脚本已经定过一次了）。 */
export function isFxReduced() {
  try {
    return document.documentElement.getAttribute(ATTR) === ON
  } catch (e) {
    return false
  }
}

/**
 * 在组件 / 作用域内订阅降级状态。
 * @returns {import('vue').Ref<boolean>}
 */
export function useFx() {
  const reduced = ref(isFxReduced())

  const reevaluate = () => {
    const next = computeFx()
    apply(next)
    reduced.value = next
  }

  const mqMotion = makeQuery('(prefers-reduced-motion: reduce)', reevaluate)
  const mqContrast = makeQuery('(prefers-contrast: more)', reevaluate)

  onScopeDispose(() => {
    for (const mq of [mqMotion, mqContrast]) {
      if (!mq) continue
      if (mq.removeEventListener) mq.removeEventListener('change', reevaluate)
      else if (mq.removeListener) mq.removeListener(reevaluate)
    }
  })

  return reduced
}
