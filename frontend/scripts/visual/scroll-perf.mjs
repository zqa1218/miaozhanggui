#!/usr/bin/env node
/**
 * 滚动性能观测
 *
 * 为什么单独测而不是靠 Lighthouse：Lighthouse 量的是**加载**期的主线程占用，
 * 滚动掉帧是**运行**期的问题 —— 页面早已加载完成，用户滚动时合成器/主线程
 * 每一帧在做什么，它看不到。
 *
 * 观测方法：在真实滚动的同时逐帧记录 requestAnimationFrame 的间隔。
 *   · 理想 60Hz → 16.7ms/帧
 *   · 我们关心的是**长帧**（>33ms，即掉到 30fps 以下）的比例，
 *     以及有没有 >50ms 的严重卡顿
 *
 * 与真机 DevTools 的 Rendering → Frame Rendering Stats / Paint flashing
 * 是同一类信息，只是这里能自动化、能进 CI。
 *
 * 用法：DIST_DIR=<产物> node scripts/visual/scroll-perf.mjs
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = process.env.DIST_DIR
const PORT = 4181
if (!DIST) {
  console.error('用法：DIST_DIR=<产物目录> node scripts/visual/scroll-perf.mjs')
  process.exit(1)
}

const server = spawn(process.execPath, [path.join(__dirname, 'serve.mjs')], {
  env: { ...process.env, DIST_DIR: DIST, PORT: String(PORT) },
  stdio: 'ignore',
})
await new Promise((r) => setTimeout(r, 1000))

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  // 4× CPU 降速：与 Lighthouse 的移动端预设对齐，否则结论不可比
  // （Playwright 没有直接的 CPU 降速开关，用 CDP 设）
})

const cdp = await page.context().newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

async function measure(theme, url = '/') {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('mzg_theme', t)
    } catch (e) {}
  }, theme)
  await page.route('**/api/**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, code: 0, data: [] }),
    })
  )
  await page.goto(`http://127.0.0.1:${PORT}${url}?theme=${theme}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  const raw = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const gaps = []
        let last = performance.now()
        let n = 0
        let y = 0
        let dir = 1
        let maxY = 0
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        function tick(now) {
          gaps.push(now - last)
          last = now
          // 来回滚动：单向滚到底会停在页面底部，后半程没有滚动可测
          y += 26 * dir
          if (y > maxScroll || y < 0) dir = -dir
          window.scrollTo(0, y)
          maxY = Math.max(maxY, window.scrollY)
          if (++n < 240) requestAnimationFrame(tick)
          else resolve({ gaps, maxY, maxScroll })
        }
        requestAnimationFrame(tick)
      })
  )

  const frames = raw.gaps
  const sorted = frames.slice(5).sort((a, b) => a - b) // 丢掉头几帧（含首帧的建立成本）
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
  const long = sorted.filter((g) => g > 33.4).length
  const severe = sorted.filter((g) => g > 50).length
  return {
    theme,
    n: sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1],
    longPct: (long / sorted.length) * 100,
    severe,
    // 自检：页面实际滚了多远 / 能滚多远。若 maxY 约等于 0，说明这一页
    // 根本没滚动（例如内容不足一屏或 overflow:hidden），
    // 那么「不掉帧」这个结论是无意义的 —— 什么都没发生当然不掉帧。
    maxY: raw.maxY,
    maxScroll: raw.maxScroll,
  }
}

const classic = await measure('classic')
const glass = await measure('glass')

await browser.close()
server.kill()

const f = (n) => `${n.toFixed(1)} ms`
const pad = (s, n) => String(s).padEnd(n, ' ')

console.log('\n\x1b[1m滚动帧率观测 · 390×844 · CDP CPU 降速 4×\x1b[0m')
console.log(`产物：${DIST}`)
console.log('─'.repeat(66))
console.log(pad('指标', 30) + pad('classic', 16) + 'glass')
console.log('─'.repeat(66))
console.log(pad('采样帧数', 30) + pad(String(classic.n), 16) + String(glass.n))
console.log(pad('帧间隔 p50（理想 16.7ms）', 30) + pad(f(classic.p50), 16) + f(glass.p50))
console.log(pad('帧间隔 p95', 30) + pad(f(classic.p95), 16) + f(glass.p95))
console.log(pad('最长帧', 30) + pad(f(classic.max), 16) + f(glass.max))
console.log(pad('长帧占比（>33ms 掉到 30fps 下）', 30) + pad(classic.longPct.toFixed(1) + '%', 16) + glass.longPct.toFixed(1) + '%')
console.log(pad('严重卡顿帧数（>50ms）', 30) + pad(String(classic.severe), 16) + String(glass.severe))
console.log(pad('实际滚动距离 / 可滚距离', 30) + pad(`${Math.round(classic.maxY)}/${classic.maxScroll}px`, 16) + `${Math.round(glass.maxY)}/${glass.maxScroll}px`)
console.log('─'.repeat(66))
console.log('注：本项无既定预算，只作两套主题的相对比较与趋势观测。')
console.log()
