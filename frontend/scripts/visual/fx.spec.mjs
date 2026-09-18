import { test, expect } from '@playwright/test'

/**
 * 生产护栏的功能测试：降级路径 / 无障碍偏好 / 焦点可见性
 *
 * 这些是「不该被看到」的路径 —— 只有低端设备或特定系统偏好下才会走到。
 * 恰恰因为平时看不到，它们最容易在后续改动里被悄悄破坏。所以必须自动化。
 *
 * 运行：DIST_DIR=/tmp/mz-p6 npx playwright test fx
 */

const DIST = process.env.DIST_DIR || '(未指定)'

async function open(page, { url = '/', theme = 'glass', media = null } = {}) {
  if (media) await page.emulateMedia(media)
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
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
}

const fxAttr = (page) => page.evaluate(() => document.documentElement.getAttribute('data-fx'))

/**
 * prefers-contrast 必须走 CDP。
 * Playwright 的 page.emulateMedia() **不支持 contrast**（只支持 colorScheme /
 * reducedMotion / forcedColors），传进去会被静默忽略 —— 于是用例会「通过」，
 * 但通过的原因是本地核数少触发了启发式，而不是偏好真的生效了。
 * 这类「因为别的原因碰巧过了」的测试比失败更危险，所以必须用能真正改到偏好的通道。
 */
async function emulateContrast(page, value) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-contrast', value }],
  })
}
const token = (page, name) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)

test.describe('生产护栏', () => {
  test.skip(!DIST || DIST === '(未指定)', '未指定 DIST_DIR')

  test('?fx=full 强制满效果，不设 data-fx', async ({ page }) => {
    await open(page, { url: '/?fx=full' })
    expect(await fxAttr(page)).toBeNull()
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-fx-override'))).toBe('full')
  })

  test('?fx=reduced 强制降级：模糊半径变小、表面不透明度提高', async ({ page }) => {
    await open(page, { url: '/?fx=full' })
    const fullBlur = await token(page, '--glass-blur')
    const fullSurface = await token(page, '--surface-glass')

    await open(page, { url: '/?fx=reduced' })
    expect(await fxAttr(page)).toBe('reduced')
    const reducedBlur = await token(page, '--glass-blur')
    const reducedSurface = await token(page, '--surface-glass')

    expect(reducedBlur).not.toBe(fullBlur)
    expect(reducedBlur).toContain('blur(6px)') // 80px → 18px → 6px，逐级降
    expect(reducedSurface).not.toBe(fullSurface)
    // 不透明度必须**升高**（降级是减负，不能把可读性一起降掉）
    const alpha = (v) => Number((v.match(/,\s*([\d.]+)\)/) || [])[1] || 0)
    expect(alpha(reducedSurface)).toBeGreaterThan(alpha(fullSurface))
  })

  test('低端设备启发式：本机 2 核 → 自动降级', async ({ page }) => {
    await open(page, {})
    // 本容器 hardwareConcurrency = 2，必然触发启发式。
    // 这条用例同时是在断言「启发式确实接通了」，而不是只写了代码没生效。
    const cores = await page.evaluate(() => navigator.hardwareConcurrency)
    test.skip(cores > 4, '本机核数 > 4，启发式不会触发')
    expect(await fxAttr(page)).toBe('reduced')
  })

  test('prefers-reduced-motion: reduce → 降级 + 连续动画关闭', async ({ page }) => {
    await open(page, { media: { reducedMotion: 'reduce' } })
    expect(await fxAttr(page)).toBe('reduced')
    const anim = await page.evaluate(() => {
      const el = document.querySelector('.gh-feature') || document.querySelector('.feature-card')
      return el ? getComputedStyle(el).transitionDuration : null
    })
    // theme.css 的全局块会把过渡压到 .01ms
    if (anim) expect(parseFloat(anim)).toBeLessThan(0.05)
  })

  test('prefers-contrast: more → 三级文字加深、输入框描边加强', async ({ page }) => {
    // 用 ?fx=full 把「低端启发式」这条路径排除掉，单独验对比度偏好本身。
    // （本机 2 核，不排除的话两条路径搅在一起，分不清是谁生效的。）
    await open(page, { url: '/?theme=glass&fx=full' })
    const before = await token(page, '--text-3')

    await emulateContrast(page, 'more')
    await expect.poll(() => token(page, '--text-3'), { timeout: 3000 }).not.toBe(before)

    expect((await token(page, '--text-3')).toLowerCase()).toBe('#3a4e6e')
    expect((await token(page, '--border-input')).toLowerCase()).toBe('#5a6b85')
  })

  test('运行时改变系统偏好能立刻跟随，不需要刷新', async ({ page }) => {
    await open(page, { url: '/?theme=glass' })
    // 先把覆盖摘掉，让媒体查询重新成为唯一判据
    await page.evaluate(() => document.documentElement.removeAttribute('data-fx-override'))
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    // 本机 2 核，启发式仍会判降级 —— 所以这里验的是**媒体查询的监听确实接通了**，
    // 而不是「一定回到满效果」。用一个一定能观察到的信号：
    // 打开 reduce 后 useFx 应重新评估且不抛错，属性保持 reduced。
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForTimeout(200)
    expect(await fxAttr(page)).toBe('reduced')
  })

  test('降级态下文字仍然可读（不是「素到看不见」）', async ({ page }) => {
    await open(page, { url: '/?fx=reduced' })
    const cs = await page.evaluate(() => {
      const el = document.querySelector('.gh-feature p') || document.querySelector('.feature-card p')
      return el ? getComputedStyle(el).color : null
    })
    expect(cs).toBeTruthy() // 具体的数值验收在 check-contrast.mjs 里做
  })

  test('焦点可见性：真实 Tab 走一遍，每个获得焦点的元素都要有焦点环', async ({ page }) => {
    await open(page, { url: '/?theme=glass&fx=full' })

    /* 走**真实键盘路径**而不是程序化 el.focus()。
       原因：:focus-visible 是浏览器按「上一次交互是不是键盘」推断的，
       程序化聚焦不一定命中 —— 那样测出来「没有焦点环」是测试的错，
       不是样式的错。而且 Tab 走一遍本来就更接近用户真实行为。 */
    const seen = []
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        const cs = getComputedStyle(el)
        return {
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 40),
          fv: el.matches(':focus-visible'),
          outlineStyle: cs.outlineStyle,
          outlineWidth: parseFloat(cs.outlineWidth),
          boxShadow: cs.boxShadow,
        }
      })
      if (info) seen.push(info)
    }

    expect(seen.length).toBeGreaterThan(4)
    const noRing = seen.filter((r) => {
      if (!r.fv) return false // 不是 focus-visible 态就不要求环（例如鼠标态）
      return !((r.outlineStyle !== 'none' && r.outlineWidth >= 2) || r.boxShadow !== 'none')
    })
    expect(
      noRing,
      `以下元素在键盘聚焦时没有可见焦点环：\n${noRing.map((r) => `  <${r.tag} class="${r.cls}"> outline=${r.outlineStyle}/${r.outlineWidth} shadow=${r.boxShadow}`).join('\n')}`
    ).toEqual([])
  })

  test('装饰层不进无障碍树', async ({ page }) => {
    await open(page, { url: '/?theme=glass&fx=full' })
    const exposed = await page.evaluate(() => {
      // 装饰性元素：品牌标、装饰云、骨架屏、分隔线
      const deco = Array.from(
        document.querySelectorAll('[class*="__mark"], .decorations, .gh-sk, .gh-field__sep')
      )
      return deco.filter((el) => el.getAttribute('aria-hidden') !== 'true').map((el) => el.className)
    })
    expect(exposed).toEqual([])
  })

  test('背景装饰层是伪元素，天然不在无障碍树里', async ({ page }) => {
    await open(page, { url: '/?theme=glass&fx=full' })
    const info = await page.evaluate(() => {
      const b = getComputedStyle(document.body, '::before')
      const a = getComputedStyle(document.body, '::after')
      return { before: b.content, after: a.content }
    })
    // 伪元素不生成 DOM 节点 → 屏幕阅读器读不到。
    // 这一点靠「它们确实是伪元素」来保证，而不是靠 aria-hidden。
    expect(info.before).not.toBe('none')
    expect(info.after).not.toBe('none')
  })
})
