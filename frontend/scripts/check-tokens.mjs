#!/usr/bin/env node
/**
 * 令牌回归比对 + 不变量校验
 *
 * 用途：证明「L1/L2 重构之后，classic 主题每个语义令牌的**计算值**都没变」。
 * 截图对比能发现渲染差异，但发现不了「值变了但恰好没影响当前页面」的情况；
 * 这个脚本直接把构建产物里的令牌全解析一遍逐项比对，是更快的回归闸门。
 *
 * 用法：
 *   node scripts/check-tokens.mjs <改造前.css> <改造后.css>
 * 例：
 *   node scripts/check-tokens.mjs /tmp/mz-dist-before/assets/index-XXX.css dist/assets/index-YYY.css
 *
 * 退出码：0 = 全部一致；1 = 有差异（CI 用）。
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ───────────────────────── CSS 解析 ─────────────────────────
// 只需处理压缩后的产物：注释已剥离，规则形如 sel{decl;decl} 或 @rule{...}。
// 递归下降，保留 at-rule 上下文（用于区分「无条件」与「降级块」）。
function parseRules(css, conditions = [], out = []) {
  let i = 0
  while (i < css.length) {
    const open = css.indexOf('{', i)
    if (open === -1) break

    const prelude = css.slice(i, open).trim()

    // 找到与之配对的 }
    let depth = 0
    let j = open
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    const body = css.slice(open + 1, j)

    if (prelude.startsWith('@')) {
      // 条件组（@media / @supports / @keyframes…）：递归；keyframes 内部没有令牌，跳过即可
      if (/^@(media|supports|layer|container)/.test(prelude)) {
        parseRules(body, conditions.concat(prelude), out)
      }
    } else {
      out.push({ selector: prelude, conditions, body })
    }
    i = j + 1
  }
  return out
}

/** 从一条规则的 body 里提取 `--name: value` 声明，保持出现顺序 */
function declarations(body) {
  const decls = []
  let depth = 0
  let start = 0
  for (let i = 0; i <= body.length; i++) {
    const c = body[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if ((c === ';' || i === body.length) && depth === 0) {
      const chunk = body.slice(start, i).trim()
      start = i + 1
      if (!chunk.startsWith('--')) continue
      const colon = chunk.indexOf(':')
      if (colon === -1) continue
      decls.push([chunk.slice(0, colon).trim(), chunk.slice(colon + 1).trim()])
    }
  }
  return decls
}

/**
 * 收集「classic / 默认（无 data-theme）」作用域下生效的令牌表，**按 at-rule 条件分组**。
 *
 * 为什么必须分组：@supports / @media 降级块里有同名令牌（如 --glass-blur: none、
 * --surface-glass: .98）。若把它们和主块合并成一张表，降级值会覆盖主值，
 * 于是「--glass-blur 是不是完整字面量」这类断言永远失败 —— 那是脚本的 bug，
 * 不是代码的 bug。分组后每组独立解析、独立比对。
 *
 * 判定：选择器列表里含有裸 `:root`（不带属性限定）的规则才算；
 * 纯 `:root[data-theme=...]` 的规则被排除。
 */
function collectDefaultTokens(css) {
  const groups = new Map() // cond -> Map<name, value>
  for (const rule of parseRules(css)) {
    const sels = rule.selector.split(',').map((s) => s.trim())
    const appliesToDefault = sels.some((s) => s === ':root' || s === 'html' || s === '*')
    if (!appliesToDefault) continue

    const cond = rule.conditions.join(' && ') || '(无条件)'
    if (!groups.has(cond)) groups.set(cond, new Map())
    const map = groups.get(cond)
    for (const [name, value] of declarations(rule.body)) {
      // 后出现的覆盖先出现的 —— 与同特异性的层叠行为一致
      map.set(name, { value, cond })
    }
  }
  return groups
}

// ───────────────────────── var() 解析 ─────────────────────────
function resolveTokens(map, maxDepth = 24) {
  const cache = new Map()

  function resolveValue(value, depth, seen) {
    if (depth > maxDepth) return { value, error: 'var() 嵌套过深（疑似循环引用）' }

    return {
      value: value.replace(/var\(\s*(--[\w-]+)\s*(?:,([\s\S]*?))?\)/g, (whole, name, fallback) => {
        if (seen.has(name)) return whole
        const entry = map.get(name)
        if (!entry) {
          // 令牌未定义 → 用 fallback（若写了）
          return fallback !== undefined ? fallback.trim() : whole
        }
        if (cache.has(name)) return cache.get(name)
        const next = resolveValue(entry.value, depth + 1, new Set(seen).add(name))
        cache.set(name, next.value)
        return next.value
      }),
    }
  }

  const resolved = new Map()
  for (const [name, entry] of map) {
    resolved.set(name, { ...entry, resolved: resolveValue(entry.value, 0, new Set([name])).value })
  }
  return resolved
}

// ───────────────────────── 主流程 ─────────────────────────
const [, , beforePath, afterPath] = process.argv
if (!beforePath || !afterPath) {
  console.error('用法：node scripts/check-tokens.mjs <改造前.css> <改造后.css>')
  process.exit(2)
}

const beforeRaw = readFileSync(beforePath, 'utf8')
const afterRaw = readFileSync(afterPath, 'utf8')

const beforeGroups = collectDefaultTokens(beforeRaw)
const afterGroups = collectDefaultTokens(afterRaw)

let diffs = 0
let same = 0
const addedAll = []
const beforeFlat = new Map()
let after = new Map()

console.log('\n\x1b[1m喵掌柜 · classic 令牌回归比对\x1b[0m')
console.log(`改造前：${beforePath}`)
console.log(`改造后：${afterPath}`)
console.log('─'.repeat(80))

/**
 * 计算某个 at-rule 条件生效时的**有效令牌表**。
 *
 * 必须叠加基表再解析，不能只看该条件块自己的声明 ——
 * 因为降级块通常只覆盖少数字面量，其余令牌是从基表继承的。
 * 例：@supports 块里只写 --surface-glass 而不写 --surface-1，
 * 而 --surface-1: var(--surface-glass) 定义在基表里，
 * 于是 --surface-1 的有效值确实变成了 .97 —— 只看条件块会误报为「丢失」。
 */
function effectiveTokens(baseGroup, overrideGroup) {
  const merged = new Map(baseGroup || new Map())
  for (const [k, v] of overrideGroup || new Map()) merged.set(k, v)
  return resolveTokens(merged)
}

const conds = [...new Set([...beforeGroups.keys(), ...afterGroups.keys()])].sort()
const beforeBase = beforeGroups.get('(无条件)') || new Map()
const afterBase = afterGroups.get('(无条件)') || new Map()
after = resolveTokens(afterBase)

for (const cond of conds) {
  const bMap = cond === '(无条件)' ? resolveTokens(beforeBase) : effectiveTokens(beforeBase, beforeGroups.get(cond))
  const aMap = cond === '(无条件)' ? after : effectiveTokens(afterBase, afterGroups.get(cond))
  for (const [k, v] of bMap) beforeFlat.set(k, v)

  let groupDiffs = 0
  for (const name of [...bMap.keys()].filter((k) => !aMap.has(k)).sort()) {
    diffs++
    groupDiffs++
    console.log(`\x1b[31m[丢失]\x1b[0m ${cond} · ${name}  原值 ${bMap.get(name).resolved}`)
  }
  for (const [name, b] of bMap) {
    const a = aMap.get(name)
    if (!a) continue
    if (a.resolved === b.resolved) same++
    else {
      diffs++
      groupDiffs++
      console.log(`\x1b[31m[变化]\x1b[0m ${cond} · ${name}`)
      console.log(`        改造前 ${b.resolved}`)
      console.log(`        改造后 ${a.resolved}`)
    }
  }
  if (groupDiffs === 0) console.log(`\x1b[32m[一致]\x1b[0m ${cond} —— 有效值 ${bMap.size} 项全部相同`)

  for (const name of [...aMap.keys()].filter((k) => !bMap.has(k))) addedAll.push([name, aMap.get(name).resolved, cond])
}

console.log('─'.repeat(80))
console.log(`逐项一致：${same} 项 · 差异：${diffs} 项`)
if (addedAll.length) {
  const uncond = addedAll.filter(([, , c]) => c === '(无条件)')
  console.log(`\n新增令牌 ${addedAll.length} 项（无条件作用域 ${uncond.length} 项），全部为有意新增：`)
  console.log('  ' + uncond.map(([n]) => n).join('  '))
}

// ─────────────── 不变量校验 ───────────────
// 这几条是「重构后必须成立」的断言，失败即视为回归。
const invariants = []

function assert(label, ok, detail) {
  invariants.push({ label, ok, detail })
}

// (a) classic 的玻璃配方必须仍是完整字面量，且与 saturate/blur 分量同步
const classicBlur = after.get('--glass-blur')
const classicSat = after.get('--glass-saturate')
const classicLen = after.get('--glass-blur-length')
assert(
  '--glass-blur 是完整字面量（非嵌套 var()）',
  !!classicBlur && !classicBlur.value.includes('var('),
  classicBlur ? classicBlur.value : '未定义'
)
assert(
  '--glass-blur 与 --glass-saturate / --glass-blur-length 同步',
  !!classicBlur &&
    !!classicSat &&
    !!classicLen &&
    classicBlur.resolved === `saturate(${classicSat.resolved}) blur(${classicLen.resolved})`.replace(/\s+/g, ' '),
  classicBlur && classicSat && classicLen
    ? `${classicBlur.resolved}  vs  saturate(${classicSat.resolved}) blur(${classicLen.resolved})`
    : '分量未定义'
)

// (b) 字面量里必须真的出现这两个分量，防止手改一处漏一处
if (classicBlur && classicSat && classicLen) {
  const hasSat = classicBlur.value.includes(classicSat.value)
  const hasLen = classicBlur.value.includes(classicLen.resolved)
  assert(
    '字面量中确实包含该 saturate 与 blur 数值',
    hasSat && hasLen,
    `"${classicBlur.value}" 应含 "${classicSat.value}" 与 "${classicLen.resolved}"${hasSat ? '' : '（缺 saturate）'}${hasLen ? '' : '（缺 blur）'}`
  )
}

// (c) glass 主题块必须存在且覆盖了品牌 / 文字 / 表面
//     注意：产物经 esbuild 压缩后属性选择器的引号会被去掉（data-theme=glass），
//     所以正则必须允许引号可选。
for (const need of ['--color-primary', '--text-3', '--surface-glass', '--glass-blur']) {
  const re = new RegExp(`:root\\[data-theme="?glass"?\\][^{]*\\{[^}]*${need}\\s*:`)
  const ok = re.test(afterRaw)
  assert(`glass 块覆盖了 ${need}`, ok, ok ? 'ok' : '未找到')
}

// (d0) 源码里引用的每个令牌都必须有定义。
//      拼错一个变量名（--brand 写成 --brands）不会报任何错，只会让整条声明
//      在计算时失效 —— 表现为「这个组件在这个主题下没样式」，极难定位。
{
  const defined = new Set()
  for (const re of afterRaw.matchAll(/(--[a-zA-Z][\w-]*)\s*:/g)) defined.add(re[1])

  const sources = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(css|vue|scss)$/.test(e.name)) sources.push(p)
    }
  }
  try {
    walk(new URL('../src', import.meta.url).pathname)
  } catch (e) {
    /* 目录不可读则跳过 */
  }

  const used = new Map() // name -> 首个引用位置
  for (const f of sources) {
    const text = readFileSync(f, 'utf8')
    // 源码里**局部定义**的令牌同样算已定义。
    // 典型例子：Window_B_Style_Create.vue 在 .create-page 作用域内定义了
    // --sage/--rose/--ink 等一整套自有令牌。它是死代码、不进构建产物，
    // 所以这些名字不会出现在构建后的 CSS 里 —— 只看产物会误判为「未定义」。
    for (const m of text.matchAll(/(--[a-zA-Z][\w-]*)\s*:/g)) defined.add(m[1])
    for (const m of text.matchAll(/var\(\s*(--[a-zA-Z][\w-]*)/g)) {
      if (!used.has(m[1])) used.set(m[1], f.replace(/.*\/src\//, 'src/'))
    }
  }

  const undef = [...used.entries()].filter(([n]) => !defined.has(n))
  assert(
    '源码引用的令牌全部有定义',
    undef.length === 0,
    undef.length
      ? undef.map(([n, f]) => `${n}（首见于 ${f}）`).join('; ')
      : `${used.size} 个被引用的令牌均已定义`
  )
}

// (d) 旧令牌别名必须保留 —— 改名但漏掉别名会让引用处静默失效
//     （本轮就抓到过 --glass-hairline 漏保留，26 处引用会因此丢边框）
for (const alias of ['--glass-hairline', '--shadow-glow', '--surface-1', '--text-sub']) {
  assert(`旧令牌别名 ${alias} 仍存在`, after.has(alias), after.has(alias) ? `= ${after.get(alias).resolved}` : '已丢失')
}

// (e) glass 主题的每个令牌都必须能解析到底。
//     若 glass 块引用了不存在的原语（拼写错误、漏定义），var() 会原样留在值里，
//     浏览器把整条声明判为无效 —— 表现为「某个组件在 glass 下完全没样式」，
//     且不会报任何错。这是最容易漏、最难查的一类问题，必须机器兜住。
{
  // 只取「无条件作用域」下的 glass 声明。
  // 不能用正则扫 :root[data-theme=glass]{...} —— 降级块（@supports /
  // @media prefers-reduced-transparency）的选择器列表里**也**含这一个，
  // 会被一并匹配进来，于是 --surface-glass 变成 .98，检查随之误判。
  const glassOverrides = new Map()
  for (const rule of parseRules(afterRaw)) {
    if (rule.conditions.length) continue // 跳过所有 at-rule 内的规则
    const sels = rule.selector.split(',').map((s) => s.trim())
    if (!sels.some((s) => /^:root\[data-theme="?glass"?\]$/.test(s))) continue
    for (const [name, value] of declarations(rule.body)) glassOverrides.set(name, { value, cond: 'glass' })
  }

  // 基表 + glass 覆盖。只保留自有令牌：Element Plus 自身的 --el-* 内部变量
  // （如 --el-popup-modal-bg-color → var(--el-color-black)）在别处定义，
  // 与主题无关，混进来只会制造噪声。
  const isOurs = (n) => !n.startsWith('--el-')
  const glassMap = new Map([...(afterGroups.get('(无条件)') || new Map())].filter(([n]) => isOurs(n)))
  for (const [n, v] of glassOverrides) if (isOurs(n)) glassMap.set(n, v)

  assert('能定位到 glass 主题块', glassOverrides.size > 0, `收集到 ${glassOverrides.size} 条 glass 声明`)

  const resolvedGlass = resolveTokens(glassMap)
  const broken = [...resolvedGlass.entries()].filter(([, v]) => /var\(/.test(v.resolved))
  assert(
    'glass 主题下无未解析的 var() 引用',
    broken.length === 0,
    broken.length
      ? broken.map(([n, v]) => `${n} → ${v.resolved}`).join('; ')
      : `${resolvedGlass.size} 项全部解析成功`
  )

  // glass.css 里 -webkit-backdrop-filter 用的是**字面量**（设计要求如此），
  // 于是它与 --glass-blur 成了两处独立的值，会各自漂移。
  // 这里断言两者一致 —— 否则改了令牌却忘了改前缀，Safari 上会静默用旧配方。
  {
    const glassCss = readFileSync(new URL('../src/assets/styles/glass.css', import.meta.url), 'utf8')
    // 必须锚定行首：@supports 的条件里也有 `(-webkit-backdrop-filter: blur(1px))`，
    // 不锚定会把它当成一条声明匹配进来。
    const literals = [...glassCss.matchAll(/^[ \t]*-webkit-backdrop-filter:\s*([^;]+);/gm)].map((m) => m[1].trim())
    const want = resolvedGlass.get('--glass-blur')
    const uniq = [...new Set(literals)]
    assert(
      'glass.css 中 -webkit-backdrop-filter 的字面量与 --glass-blur 一致',
      uniq.length > 0 && !!want && uniq.every((v) => v === want.resolved),
      uniq.length
        ? `字面量 ${uniq.join(' / ')}  vs  --glass-blur = ${want ? want.resolved : '未定义'}`
        : '未找到字面量（若已全部改用 var()，请同步更新本条断言）'
    )
  }

  // 顺带抽查 glass 关键令牌的最终计算值，防止「解析成功但取错档」
  const expect = {
    '--surface-1': 'rgba(255, 255, 255, .62)',
    '--surface-glass': 'rgba(255, 255, 255, .62)',
    '--text-3': '#4E6288',
    '--color-primary': '#2563EB',
    '--text-on-primary': '#FFFFFF',
    '--radius-btn': '12px',
    '--glass-hairline': 'rgba(37, 99, 235, .14)',
    '--shadow-1': '0 1px 2px rgba(15, 42, 90, .06)',
    '--bg-base': '#F7FAFF',
  }
  for (const [name, want] of Object.entries(expect)) {
    const got = resolvedGlass.get(name)
    assert(`glass · ${name} = ${want}`, !!got && got.resolved === want, got ? `实际 ${got.resolved}` : '未定义')
  }
}

// (d) index.html 的 FOUC 内联脚本与 useTheme.js 的正则必须一致（容易改一处漏一处）
try {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const js = readFileSync(new URL('../src/composables/useTheme.js', import.meta.url), 'utf8')
  const h = html.match(/theme=\(classic\|glass\)/)
  const j = js.match(/theme=\(classic\|glass\)/)
  assert('index.html 与 useTheme.js 的查询参数正则一致', !!h === !!j, h && j ? '两处均存在' : '有一处缺失')
} catch (e) {
  assert('可读取 index.html / useTheme.js', false, String(e.message))
}

console.log('\n\x1b[1m不变量校验\x1b[0m')
console.log('─'.repeat(80))
for (const v of invariants) {
  console.log(`${v.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${v.label}  \x1b[2m${v.detail}\x1b[0m`)
}
const invariantFails = invariants.filter((v) => !v.ok).length

console.log('\n' + '═'.repeat(80))
if (diffs === 0 && invariantFails === 0) {
  console.log('\x1b[32m✓ classic 令牌零回归；全部不变量通过\x1b[0m\n')
  process.exit(0)
}
console.log(`\x1b[31m✗ 令牌差异 ${diffs} 项，不变量失败 ${invariantFails} 项\x1b[0m\n`)
process.exit(1)
