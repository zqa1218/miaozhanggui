#!/usr/bin/env node
/**
 * 两套主题的 Lighthouse 对比（移动端）
 *
 * 为什么两套要跑同一次会话、同一个服务器、同一份产物：
 * 主题之间要对比的是**渲染成本**，不是数据。任何一边多一次请求、
 * 多一张图，差异就不可比了。
 *
 * 已知局限（结论里必须一起读）：
 *   本脚本走的是静态服务器，/api/** 没有后端 → 页面停在空状态/骨架。
 *   这对两套主题是**同等**的，所以对比有效；但绝对分值不代表线上真实表现。
 *   服务端渲染、真实图片、真实接口延迟都会改变 LCP/TBT 的绝对值。
 *
 * 用法：
 *   CHROME_PATH=<chromium> DIST_DIR=<产物> node scripts/lighthouse.mjs
 */
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = process.env.DIST_DIR
const PORT = 4180
const CHROME = process.env.CHROME_PATH

if (!DIST) {
  console.error('用法：DIST_DIR=<产物目录> CHROME_PATH=<chromium 可执行文件> node scripts/lighthouse.mjs')
  process.exit(1)
}

/* ── 起静态服务器 ── */
const server = spawn(process.execPath, [path.join(__dirname, 'visual', 'serve.mjs')], {
  env: { ...process.env, DIST_DIR: DIST, PORT: String(PORT) },
  stdio: 'ignore',
})
await new Promise((r) => setTimeout(r, 1200))

async function runOne(theme) {
  const chrome = await launch({
    chromePath: CHROME,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
  try {
    const res = await lighthouse(`http://127.0.0.1:${PORT}/?theme=${theme}`, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
      // 移动端预设：与 Chrome DevTools 的 "Mobile" 档一致
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
      throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
      throttlingMethod: 'simulate',
    })
    const lhr = res.lhr
    const a = lhr.audits
    return {
      theme,
      performance: Math.round(lhr.categories.performance.score * 100),
      lcp: a['largest-contentful-paint'].numericValue,
      lcpEl: a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet || '—',
      cls: a['cumulative-layout-shift'].numericValue,
      tbt: a['total-blocking-time'].numericValue,
      fcp: a['first-contentful-paint'].numericValue,
      si: a['speed-index'].numericValue,
      // 装饰层与模糊是否被算进主线程开销
      mainThread: a['mainthread-work-breakdown']?.numericValue,
      // 首屏图片（应为空 —— LCP 元素是文本）
      imgCount: a['modern-image-formats']?.details?.items?.length ?? 0,
    }
  } finally {
    await chrome.kill()
  }
}

const classic = await runOne('classic')
const glass = await runOne('glass')
server.kill()

const f = (n) => (n >= 1000 ? (n / 1000).toFixed(2) + ' s' : Math.round(n) + ' ms')
const pad = (s, n) => String(s).padEnd(n, ' ')

console.log('\n\x1b[1mLighthouse · 移动端（模拟 4G + 4× CPU 降速）\x1b[0m')
console.log(`产物：${DIST}`)
console.log('─'.repeat(72))
console.log(pad('指标', 22) + pad('classic', 16) + pad('glass', 16) + 'Δ')
console.log('─'.repeat(72))

const rows = [
  ['Performance 得分', (r) => String(r.performance), (r) => String(r.performance)],
  ['FCP', (r) => f(r.fcp), (r) => f(r.fcp)],
  ['LCP', (r) => f(r.lcp), (r) => f(r.lcp)],
  ['CLS', (r) => r.cls.toFixed(4), (r) => r.cls.toFixed(4)],
  ['TBT', (r) => f(r.tbt), (r) => f(r.tbt)],
  ['Speed Index', (r) => f(r.si), (r) => f(r.si)],
  ['主线程总耗时', (r) => f(r.mainThread), (r) => f(r.mainThread)],
]
for (const [label, fc, fg] of rows) {
  console.log(pad(label, 22) + pad(fc(classic), 16) + pad(fg(glass), 16))
}

console.log('─'.repeat(72))
console.log(`LCP 元素（classic）：${classic.lcpEl}`)
console.log(`LCP 元素（glass）  ：${glass.lcpEl}`)

// 注意方向：判据是「glass 不比 classic 差」，即 glass.lcp <= classic.lcp × 1.1。
// （初版把两边写反了，于是永远通过 —— 一个恒真的断言比没有断言更危险。）
const lcpOk = glass.lcp <= classic.lcp * 1.1
const clsOk = glass.cls < 0.05
const tbtOk = glass.tbt <= classic.tbt * 1.3
console.log(
  `\nLCP 不劣化（glass ≤ classic × 1.1）：${lcpOk ? '\x1b[32m通过\x1b[0m' : '\x1b[31m未通过\x1b[0m'}` +
    ` · CLS < 0.05：${clsOk ? '\x1b[32m通过\x1b[0m' : '\x1b[31m未通过\x1b[0m'}` +
    ` · TBT 增幅 ≤30%：${tbtOk ? '\x1b[32m通过\x1b[0m' : '\x1b[31m未通过\x1b[0m'}`
)
console.log()
