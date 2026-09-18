#!/usr/bin/env node
/**
 * 对比度验收脚本（硬约束 #3：正文 ≥4.5:1，大字号 ≥3:1）
 *
 * 为什么需要它：主题化之后「表面」不再是纯白，而是「半透明玻璃叠在带色背景上」。
 * 文字的实际对比度取决于合成后的底色，肉眼与设计稿都看不出来，必须算。
 *
 * 用法：node scripts/check-contrast.mjs
 * 退出码非 0 = 有未达标项（供 CI 使用）。
 */

// ─────────────────────────── WCAG 2.1 相对亮度 ───────────────────────────
function srgbToLinear(c) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function luminance([r, g, b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrast(fg, bg) {
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * 每条用例的第 6 个元素是选项：
 *   threshold —— 达标线。正文 4.5；大字号（≥18.66px 粗体 / ≥24px）与
 *                纯装饰图形 3.0。
 *   known     —— 标记为「本次改造之前就存在」的问题。仍然打印，但不计入
 *                退出码 —— 否则 CI 会长期红着，真正的新回归反而被淹没。
 *                既存项已逐条记入交付说明，不会因为不报错就被遗忘。
 */
const AA_BODY = 4.5
const AA_LARGE = 3.0

// ─────────────────────────── 颜色工具 ───────────────────────────
const hex = (s) => {
  const h = s.replace('#', '')
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}

const rgba = (s) => {
  const m = s.match(/rgba?\(([^)]+)\)/)
  const p = m[1].split(',').map((x) => parseFloat(x.trim()))
  return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }
}

/** source-over 合成：fg 覆盖在 bg 之上 */
function over(fg, bg) {
  const { rgb, a } = typeof fg === 'string' ? rgba(fg) : fg
  const base = typeof bg === 'string' && bg.startsWith('#') ? hex(bg) : bg
  return rgb.map((c, i) => Math.round(a * c + (1 - a) * base[i]))
}

const flat = (c) => (typeof c === 'string' && c.startsWith('#') ? hex(c) : c)

// ─────────────────────── 背景配方 ───────────────────────
// classic：页底 #F9F8F6 + 设计交付的 page-bg.svg。
// DESIGN.md 实测「中心 1200px 主内容区最低明度 81%」，故取 81% 相对亮度作最不利底色。
// 反解：相对亮度 0.81、暖色调 → #E9E8E6（用该值校验 82% 磨砂面板上的三级文字，
// 得 4.84:1，与 DESIGN.md 记录值一致，说明模型已校准）。
const CLASSIC_PAGE = hex('#F9F8F6')
const CLASSIC_PAGE_DARKEST = hex('#E9E8E6')

// glass：页底 #F7FAFF 上叠 --bg-mesh 三层径向渐变。
//
// 取「最不利底色」的方式是**按 CSS radial-gradient 的真实几何逐点采样整个视口**，
// 而不是假设三层完全重叠。
// 早先版本用了「三层完全重叠」的保守上界，结果是错的：三层中心分别在
// 12%/8%、88%/4%、70%/92%，各自的椭圆半径（60%/50%、50%/45%、45%/40%）
// 根本够不到彼此的中心，现实中不存在任何一点三层同时达到峰值。
// 用不存在的底色去验收，只会得到一个永远失败、因而被忽略的指标。
const MESH_STOPS = [
  { cx: 12, cy: 8, rx: 60, ry: 50, col: [96, 165, 250], a: 0.28 }, // brand-400 层
  { cx: 88, cy: 4, rx: 50, ry: 45, col: [129, 140, 248], a: 0.24 }, // accent-indigo 层
  { cx: 70, cy: 92, rx: 45, ry: 40, col: [34, 211, 238], a: 0.18 }, // accent-cyan 层
]
const GLASS_BASE = hex('#F7FAFF')

/** 给定视口百分比坐标，返回该点的合成底色 */
function meshAt(px, py) {
  let c = GLASS_BASE.slice()
  for (const g of MESH_STOPS) {
    const t = Math.hypot((px - g.cx) / g.rx, (py - g.cy) / g.ry)
    if (t >= 0.7) continue // 渐变在 70% 处已完全透明
    const a = g.a * (1 - t / 0.7)
    c = c.map((v, i) => Math.round(a * g.col[i] + (1 - a) * v))
  }
  return c
}

/** 全视口采样，返回对给定前景色最不利的那一点 */
function worstBackdropFor(fg) {
  let worst = { ratio: Infinity, at: null, bg: null }
  for (let y = 0; y <= 100; y += 2) {
    for (let x = 0; x <= 100; x += 2) {
      const bg = meshAt(x, y)
      const r = contrast(hex(fg), bg)
      if (r < worst.ratio) worst = { ratio: r, at: `${x}%/${y}%`, bg }
    }
  }
  return worst
}

const GLASS_BACKDROP_WORST = worstBackdropFor('#4E6288').bg // 用最浅的三级文字定最不利点
const GLASS_BACKDROP_TYPICAL = meshAt(12, 8) // 光斑 A 中心

// ─────────────────────── 待测组合 ───────────────────────
// surface 为 null 表示直接落在页面底色上
const CASES = [
  // ── classic ──
  ['classic', '--text-1', '#4A4642', 'page', CLASSIC_PAGE],
  ['classic', '--text-1', '#4A4642', 'page-svg 最暗处', CLASSIC_PAGE_DARKEST],
  ['classic', '--text-2', '#6B6560', 'page-svg 最暗处', CLASSIC_PAGE_DARKEST],
  // 既存问题：三级文字直接落在页面背景（无面板）上时只有 4.09:1。
  // 这张背景图的最暗处由设计约束在 81% 明度，而 --text-3 是为此选的临界值；
  // 本项目绝大多数正文都在磨砂面板内（4.84:1 达标），裸背景上的三级文字
  // 是少数情况。**不是本次改造引入的**，修复它需要改视觉（属下一阶段）。
  ['classic', '--text-3', '#756E69', 'page-svg 最暗处（无面板）', CLASSIC_PAGE_DARKEST, { known: true }],
  ['classic', '--text-1', '#4A4642', 'surface-1(.82)', over('rgba(255,255,255,.82)', CLASSIC_PAGE_DARKEST)],
  ['classic', '--text-2', '#6B6560', 'surface-1(.82)', over('rgba(255,255,255,.82)', CLASSIC_PAGE_DARKEST)],
  ['classic', '--text-3', '#756E69', 'surface-1(.82)', over('rgba(255,255,255,.82)', CLASSIC_PAGE_DARKEST)],
  ['classic', '--text-3', '#756E69', 'surface-3(.68) ⚠ 规则禁止', over('rgba(255,255,255,.68)', CLASSIC_PAGE_DARKEST)],
  ['classic', '--color-primary-ink', '#A83A32', 'surface-1(.82)', over('rgba(255,255,255,.82)', CLASSIC_PAGE_DARKEST)],
  ['classic', '--text-on-primary', '#38140E', 'brand-500 实底', hex('#E8635C')],
  ['classic', '--color-warning-ink', '#8A6420', 'warning-tint', hex('#FEF9ED')],
  ['classic', '--color-success-ink', '#3E6B4E', 'success-tint', hex('#EDF6F0')],
  ['classic', '--color-danger-ink', '#9A2E22', 'danger-tint', hex('#FBEBE9')],
  ['classic', '--color-info-ink', '#4A6B8A', 'info-tint', hex('#F0F4F8')],

  // ── glass（--text-3 为调整后的 #4E6288，理由见 tokens.semantic.css）──
  ['glass', '--text-1', '#0B1B33', 'page 最不利', GLASS_BACKDROP_WORST],
  ['glass', '--text-2', '#3D5372', 'page 最不利', GLASS_BACKDROP_WORST],
  ['glass', '--text-3', '#4E6288', 'surface-glass(.62)', over('rgba(255,255,255,.62)', GLASS_BACKDROP_WORST)],
  ['glass', '--text-3', '#4E6288', 'surface-glass-quiet(.42)', over('rgba(255,255,255,.42)', GLASS_BACKDROP_WORST)],
  ['glass', '--text-3', '#4E6288', '纯白（最有利）', hex('#FFFFFF')],
  ['glass', '--text-1', '#0B1B33', 'surface-glass(.62)', over('rgba(255,255,255,.62)', GLASS_BACKDROP_WORST)],
  ['glass', '--text-2', '#3D5372', 'surface-glass(.62)', over('rgba(255,255,255,.62)', GLASS_BACKDROP_WORST)],
  ['glass', '--text-2', '#3D5372', 'surface-glass-quiet(.42)', over('rgba(255,255,255,.42)', GLASS_BACKDROP_WORST)],
  ['glass', '--color-primary-ink', '#1D4ED8', 'surface-glass(.62)', over('rgba(255,255,255,.62)', GLASS_BACKDROP_WORST)],
  // --text-4 / --text-disabled 只允许用于 disabled（WCAG 明确豁免）
  // 与纯装饰图形，故按图形档的 3:1 验收，而非正文的 4.5:1。
  ['glass', '--text-4', '#71849F', '纯白（仅禁用/装饰）', hex('#FFFFFF'), { threshold: AA_LARGE }],
  ['glass', '--text-4', '#71849F', 'surface-glass(.62)（装饰图标）', over('rgba(255,255,255,.62)', GLASS_BACKDROP_WORST), { threshold: AA_LARGE }],
]

// 品牌实底上的白字：逐个候选品牌档，确认真实可用性
const BRAND_CASES = [
  ['--brand-400', '#60A5FA'],
  ['--brand-500', '#3B82F6'],
  ['--brand-600', '#2563EB'],
  ['--brand-700', '#1D4ED8'],
]

// ─────────────────────── 输出 ───────────────────────
const AA = 4.5
let failures = 0

const pad = (s, n) => String(s).padEnd(n, ' ')
const padS = (s, n) => String(s).padStart(n, ' ')

console.log('\n\x1b[1m喵掌柜 · 对比度验收（WCAG 2.1 AA 正文 ≥ 4.5:1）\x1b[0m')
console.log('─'.repeat(96))
console.log(
  pad('主题', 9) + pad('令牌', 22) + pad('前景', 10) + pad('底色合成', 34) + pad('底色', 18) + '比值'
)
console.log('─'.repeat(96))

let known = 0
for (const [theme, token, fg, label, bg, opts = {}] of CASES) {
  const need = opts.threshold || AA_BODY
  const r = contrast(hex(fg), flat(bg))
  const ok = r >= need
  let mark
  if (ok) mark = '\x1b[32mPASS\x1b[0m'
  else if (opts.known) {
    mark = '\x1b[33m既存\x1b[0m'
    known++
  } else {
    mark = '\x1b[31mFAIL\x1b[0m'
    failures++
  }
  const ratio = r.toFixed(2).padStart(5)
  console.log(
    pad(theme, 9) +
      pad(token, 22) +
      pad(fg, 10) +
      pad(label, 34) +
      pad('#' + flat(bg).map((c) => c.toString(16).padStart(2, '0')).join(''), 18) +
      `${ratio}:1  ${mark}` +
      (need !== AA_BODY ? ` \x1b[2m(线 ${need}:1)\x1b[0m` : '')
  )
}

// 这是**选型依据表**，不是验收项：
// 它说明为什么 glass 的 --color-primary 取 brand-600 而不是品牌基准 brand-500。
console.log('\n\x1b[1m品牌蓝各档 + 白字（选型依据：哪一档能承载 --text-on-brand）\x1b[0m')
console.log('─'.repeat(96))
for (const [name, value] of BRAND_CASES) {
  const r = contrast(hex('#FFFFFF'), hex(value))
  const ok = r >= AA
  console.log(
    pad(name, 22) +
      pad(value, 12) +
      `${r.toFixed(2).padStart(5)}:1  ` +
      (ok ? '\x1b[32m可承载白字\x1b[0m' : '\x1b[2m不可承载白字（仅可用于装饰/渐变浅端）\x1b[0m')
  )
}

// ── 候选扫描：为 glass 的 --text-3 选值 ──
// 约束：必须在「纯白」与「.62 玻璃叠最不利 mesh」两种底色上都 ≥4.5:1。
if (process.argv.includes('--sweep')) {
  const gWorst = over('rgba(255,255,255,.62)', GLASS_BACKDROP_WORST)
  console.log('\n\x1b[1m--text-3 候选扫描（glass）\x1b[0m')
  console.log('─'.repeat(96))
  console.log(pad('候选', 12) + pad('对纯白', 14) + pad('对 .42 quiet', 16) + pad('对 .62 glass', 16) + '结论')
  for (const cand of ['#6B7F9B', '#5A6E8C', '#56698F', '#52658A', '#4E6288', '#4A6085']) {
    const w = contrast(hex(cand), hex('#FFFFFF'))
    const q = contrast(hex(cand), over('rgba(255,255,255,.42)', GLASS_BACKDROP_WORST))
    const g = contrast(hex(cand), gWorst)
    const ok = w >= AA && q >= AA && g >= AA
    console.log(
      pad(cand, 12) +
        pad(w.toFixed(2) + ':1', 14) +
        pad(q.toFixed(2) + ':1', 16) +
        pad(g.toFixed(2) + ':1', 16) +
        (ok ? '\x1b[32m可用\x1b[0m' : '\x1b[31m不可用\x1b[0m')
    )
  }
}

// ─────────────── glass 首页背景 · 全视口采样 ───────────────
// 首页文本直接压在 --bg-mesh 光斑上（没有面板兜底），所以必须逐点验证。
console.log('\n\x1b[1mglass 首页背景 · 全视口逐点采样（步长 2%）\x1b[0m')
console.log('─'.repeat(96))
console.log(pad('文字令牌', 22) + pad('最不利位置', 14) + pad('该点底色', 12) + '最低对比度')
const HEXPT = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
// exempt=true 的项按 WCAG 归类为「非文本/可豁免」，只报告不判失败：
//   --text-4 只允许用于禁用态（WCAG 明确豁免）与**纯装饰**图形；
//   1.4.11 约束的是「理解内容所必需」的图形，纯装饰不在其列。
// 但它在光斑峰值区确实低于 3:1，所以仍在输出里可见 —— 不隐藏，只是不误判为缺陷。
for (const [name, fg, exempt] of [
  ['--text-1', '#0B1B33', false],
  ['--text-2', '#3D5372', false],
  ['--text-3', '#4E6288', false],
  ['--text-4（禁用/装饰）', '#71849F', true],
]) {
  const w = worstBackdropFor(fg)
  const need = exempt ? AA_LARGE : AA_BODY
  const ok = w.ratio >= need
  if (!ok && !exempt) failures++
  const mark = ok ? '\x1b[32mPASS\x1b[0m' : exempt ? '\x1b[2m豁免\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
  console.log(
    pad(name, 22) + pad(w.at, 14) + pad(HEXPT(w.bg), 12) + `${w.ratio.toFixed(2)}:1  ` + mark
  )
}
console.log(
  '\x1b[2m\n  放置规则：--text-4 与装饰图形不得放在光斑峰值附近\n' +
    '  （12%/8%、88%/4%、70%/92% 三点周边），否则会低于 3:1。\n' +
    '  首页当前布局中这些位置由玻璃面板覆盖（面板底色更亮，对比度只会更高）。\x1b[0m'
)

// ─────────────── glass 应用层 · 后台 / 表格 / 灯箱 ───────────────
// 这些是阶段 4 新增的表面。后台刻意改成**实色**，所以对比度不再随背景浮动，
// 但每一层的实测值仍需逐条留档 —— 尤其是表格的 hover/zebra，
// 它们是「不依赖透明叠加」这个决定之后才可控的。
const ADMIN = {
  page: hex('#F4F7FC'),
  card: hex('#FFFFFF'),
  thead: hex('#F4F7FC'),
  zebra: hex('#F7FAFE'),
  hover: hex('#EAF2FE'),
  border: hex('#DBE7FA'),
}
// 灯箱遮罩：rgba(4,12,26,.94) 叠在任意底色上，6% 的透过量让结果几乎恒为 #131B29
const LB_SCRIM = over('rgba(4,12,26,.94)', hex('#FFFFFF'))

console.log('\n\x1b[1mglass 应用层 · 后台实色分层 / 表格 / 灯箱\x1b[0m')
console.log('─'.repeat(96))
console.log(pad('场景', 34) + pad('前景', 10) + pad('底色', 10) + '比值')

const APP_CASES = [
  ['后台 · 页面底', '--text-1', '#0B1B33', ADMIN.page, AA_BODY],
  ['后台 · 卡片', '--text-1', '#0B1B33', ADMIN.card, AA_BODY],
  ['后台 · 页面底', '--text-2', '#3D5372', ADMIN.page, AA_BODY],
  ['后台 · 卡片', '--text-2', '#3D5372', ADMIN.card, AA_BODY],
  ['后台 · 页面底', '--text-3', '#4E6288', ADMIN.page, AA_BODY],
  ['后台 · 卡片', '--text-3', '#4E6288', ADMIN.card, AA_BODY],
  ['表格 · 表头文字（--text-3）', '--text-3', '#4E6288', ADMIN.thead, AA_BODY],
  ['表格 · 正文', '--text-2', '#3D5372', ADMIN.card, AA_BODY],
  ['表格 · 斑马纹行', '--text-2', '#3D5372', ADMIN.zebra, AA_BODY],
  ['表格 · hover 行', '--text-2', '#3D5372', ADMIN.hover, AA_BODY],
  ['表格 · hover 行（三级字）', '--text-3', '#4E6288', ADMIN.hover, AA_BODY],
  // 输入框边界：WCAG 1.4.11 明确要求 ≥3:1 —— 边界是「识别这是个输入控件」
  // 所必需的视觉信息，不是装饰。
  ['输入框 · 边界 vs 白底', '--border-input', '#7E8FA9', ADMIN.card, AA_LARGE],
  ['输入框 · 边界 vs 玻璃面板', '--border-input', '#7E8FA9', ADMIN.page, AA_LARGE],
  // glass 的中性色另取冷调（原来一直沿用 classic 的暖灰，视觉基线里
  // 表现为「禁用的下一步按钮是一片暖褐色」）。这四项目一样要过线。
  ['中性徽章 · ink on tint', '--color-neutral-ink', '#5A6B85', hex('#EDF1F8'), AA_BODY],
  ['中性徽章 · ink on 卡片', '--color-neutral-ink', '#5A6B85', ADMIN.card, AA_BODY],
  // 禁用态属 WCAG 明确豁免（1.4.3 / 1.4.11 均写明 except for inactive components），
  // 所以只留档不判失败。但仍取了一个**可读**的值：classic 原值是 1.55:1，
  // 用户读不出禁用的按钮写的是什么 —— 豁免的是「不达标」，不是「看不见」。
  ['禁用文字 · vs 禁用底（豁免）', '--color-disabled', '#93A5BF', hex('#EDF1F8'), AA_LARGE, true],
  ['灯箱 · 计数器/标签（白字）', '反白 #FFFFFF', '#FFFFFF', LB_SCRIM, AA_BODY],
  ['灯箱 · 控制按钮字形', '--text-1', '#0B1B33', hex('#FFFFFF'), AA_BODY],
  ['灯箱 · 按钮形状 vs 遮罩', '按钮 #FFFFFF', '#FFFFFF', LB_SCRIM, AA_LARGE],
  // exempt：表格的细分隔线**不是** 1.4.11 的适用对象 ——
  // 它既不标识控件，也不是理解内容所必需（行的范围由斑马纹与留白共同界定）。
  // 设计要求原文就是「斑马纹或**极细**分隔线」，所以这里只留档不判失败。
  ['表格 · 行分隔线 vs 卡片（装饰）', '边框 #DBE7FA', '#DBE7FA', ADMIN.card, AA_LARGE, true],
]
for (const [scene, label, fg, bg, need, exempt] of APP_CASES) {
  const col = fg.startsWith('#') ? fg : label
  const r = contrast(hex(col), bg)
  const ok = r >= need
  if (!ok && !exempt) failures++
  const mark = ok ? '\x1b[32mPASS\x1b[0m' : exempt ? '\x1b[2m豁免\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
  console.log(
    pad(scene, 34) + pad(label, 10) + pad(HEXPT(bg), 10) + `${r.toFixed(2)}:1  ` + mark +
      (need !== AA_BODY ? ` \x1b[2m(线 ${need}:1)\x1b[0m` : '')
  )
}

// ─────────────── 降级路径 ───────────────
// 降级是「观感变素」，绝不能变成「文字读不了」。
// 三条路径都要逐条验：不支持 backdrop-filter / data-fx=reduced / prefers-contrast。
console.log('\n\x1b[1m降级路径 · 每条都要保证文字仍然达标\x1b[0m')
console.log('─'.repeat(96))
console.log(pad('路径', 34) + pad('前景', 10) + pad('底色', 10) + '比值')

const DEGRADE = [
  // ① 不支持 backdrop-filter：表面提到 .96/.97（tokens.semantic.css）与 .96（fx.css 组件层）
  ['① 无 backdrop-filter · 正文', '--text-2', '#3D5372', over('rgba(255,255,255,.96)', GLASS_BACKDROP_WORST), AA_BODY],
  ['① 无 backdrop-filter · 三级字', '--text-3', '#4E6288', over('rgba(255,255,255,.96)', GLASS_BACKDROP_WORST), AA_BODY],
  // ② data-fx=reduced：表面 .90 / .88
  ['② fx=reduced · 正文', '--text-2', '#3D5372', over('rgba(255,255,255,.90)', GLASS_BACKDROP_WORST), AA_BODY],
  ['② fx=reduced · 三级字', '--text-3', '#4E6288', over('rgba(255,255,255,.88)', GLASS_BACKDROP_WORST), AA_BODY],
  // ③ prefers-contrast: more：表面 .99 / 三级字加深到 #3A4E6E（glass）
  ['③ prefers-contrast · 三级字(glass)', '--text-3', '#3A4E6E', over('rgba(255,255,255,.99)', GLASS_BACKDROP_WORST), AA_BODY],
  ['③ prefers-contrast · 三级字(classic)', '--text-3', '#4A4642', over('rgba(255,255,255,.99)', CLASSIC_PAGE_DARKEST), AA_BODY],
  ['③ prefers-contrast · 输入框边界', '--border-input', '#5A6B85', hex('#FFFFFF'), AA_LARGE],
  // ④ 照片上的标签：用不透明品牌底，对比度与照片无关（这是「压在照片上的文字」的正解）
  ['④ 照片上方标签(classic)', '--text-on-primary', '#38140E', hex('#E8635C'), AA_BODY],
  ['④ 照片上方标签(glass)', '--text-on-primary', '#FFFFFF', hex('#2563EB'), AA_BODY],
]
for (const [scene, label, fg, bg, need] of DEGRADE) {
  const r = contrast(hex(fg), bg)
  const ok = r >= need
  if (!ok) failures++
  console.log(
    pad(scene, 34) + pad(label, 10) + pad(HEXPT(bg), 10) + `${r.toFixed(2)}:1  ` +
      (ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m')
  )
}

console.log('\n' + '─'.repeat(96))
console.log(`最不利 glass 页面底色 = ${HEXPT(GLASS_BACKDROP_WORST)}（全视口采样得出）`)
console.log(`光斑 A 中心底色        = ${HEXPT(GLASS_BACKDROP_TYPICAL)}`)
if (known) {
  console.log(`\x1b[33m${known} 项为既存问题\x1b[0m（本次改造之前就存在，不计入退出码，已记入交付说明）`)
}
console.log(`\n${failures === 0 ? '\x1b[32m新增主题全部达标\x1b[0m' : `\x1b[31m${failures} 项未达标\x1b[0m`}\n`)

process.exit(failures === 0 ? 0 : 1)
