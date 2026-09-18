import { test, expect } from '@playwright/test'

/**
 * 主题的默认值 / 持久化 / 降级环境 / 控制台整洁度
 *
 * 与 switcher.spec.mjs 的分工：
 *   switcher —— 切换器这个**组件**的行为（ARIA / 键盘 / 事件）
 *   本文件   —— 主题这个**系统**在异常环境下的行为（首访、隐私模式、深色偏好）
 *
 * 运行：DIST_DIR=<产物> npx playwright test theme-defaults
 */

const DIST = process.env.DIST_DIR || '(未指定)'

async function stubApi(page) {
  await page.route('**/api/**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, code: 0, data: [] }),
    })
  )
}

const themeAttr = (page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'))

test.describe('主题系统 · 默认值与异常环境', () => {
  test.skip(!DIST || DIST === '(未指定)', '未指定 DIST_DIR')

  test('首次访问（无 localStorage）→ 不写 data-theme，即 classic 兜底', async ({ page }) => {
    await stubApi(page)
    await page.goto('/?fx=full', { waitUntil: 'networkidle' })
    // 关键：内联脚本在拿不到任何偏好时**刻意不写属性**。
    // 因为 CSS 里 :root 本身就是 classic —— 这是兜底，不是省略。
    expect(await themeAttr(page)).toBeNull()
    // 且渲染的确实是 classic 首页
    await expect(page.locator('.welcome')).toHaveCount(1)
  })

  test('切换后刷新保持', async ({ page }) => {
    await stubApi(page)
    await page.addInitScript(() => {
      try {
        localStorage.setItem('mzg_theme', 'glass')
      } catch (e) {}
    })
    await page.goto('/?fx=full', { waitUntil: 'networkidle' })
    expect(await themeAttr(page)).toBe('glass')

    await page.reload({ waitUntil: 'networkidle' })
    expect(await themeAttr(page)).toBe('glass')
    await expect(page.locator('.gh')).toHaveCount(1) // 渲染的是 glass 首页
  })

  test('localStorage 不可用（隐私模式）时不崩，退到 classic', async ({ page }) => {
    await stubApi(page)
    // 模拟隐私模式：访问 localStorage 直接抛错
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError')
        },
      })
    })
    const errors = []
    const warns = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => {
      if (m.type() === 'warning') warns.push(m.text())
    })

    await page.goto('/?fx=full', { waitUntil: 'networkidle' })
    // 页面必须照常渲染。
    // 修复前这里渲染的是空白 —— route 的导航守卫读 token 时抛错、
    // 导航被中止、整个应用什么都不画（改前的产物同样如此，是既存缺陷）。
    await expect(page.locator('.welcome')).toHaveCount(1)
    expect(await themeAttr(page)).toBeNull()
    expect(errors).toEqual([])

    // 此时点切换器也不该抛错。写存储会失败并退化为内存缓存，
    // 但主题应在**本次会话内**照常生效。
    await page.locator('.tsw-trigger:visible').click()
    await page.locator('[role="menuitemradio"]:visible').nth(1).click()
    expect(await themeAttr(page)).toBe('glass')
    expect(errors).toEqual([])

    // 降级必须**可观测**，不能沉默：适配器首次触发兜底时打一条 warn。
    // 恰好一次 —— 每次读写都打就成了刷屏。
    const storageWarns = warns.filter((w) => w.includes('[storage]'))
    expect(storageWarns.length, `期望恰好一条降级警告，实际 ${storageWarns.length} 条`).toBe(1)
    expect(storageWarns[0]).toContain('内存缓存')
  })

  test('系统深色模式：不跟随，仍是浅色主题（商家后台不该某天变个样）', async ({ page }) => {
    await stubApi(page)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/?fx=full', { waitUntil: 'networkidle' })

    // 不跟随 prefers-color-scheme —— 首访仍是 classic
    expect(await themeAttr(page)).toBeNull()

    // 且没有被浏览器的暗色原生控件污染：glass 显式声明了 color-scheme: light
    await page.addInitScript(() => {
      try {
        localStorage.setItem('mzg_theme', 'glass')
      } catch (e) {}
    })
    await page.reload({ waitUntil: 'networkidle' })
    const cs = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
    expect(cs).toBe('light')
  })

  test('页面加载与切换主题期间控制台无错误 / 无警告', async ({ page }) => {
    await stubApi(page)
    const msgs = []
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') msgs.push(`[${m.type()}] ${m.text()}`)
    })
    page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`))

    await page.goto('/?fx=full', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.locator('.tsw-trigger:visible').click()
    await page.locator('[role="menuitemradio"]:visible').nth(1).click()
    await page.waitForTimeout(800)

    // 本项目是纯 SPA、没有 SSR，所以不存在 hydration mismatch。
    // 这条用例的作用是兜住另一类问题：主题切换过程中的 Vue 警告、
    // API 失败日志、未捕获异常 —— 它们同样是「控制台不干净」。
    expect(msgs, `控制台出现以下信息：\n${msgs.join('\n')}`).toEqual([])
  })

  test('?theme= 生效、优先级高于 localStorage、且不写入存储', async ({ page }) => {
    await stubApi(page)
    await page.addInitScript(() => {
      try {
        localStorage.setItem('mzg_theme', 'classic')
      } catch (e) {}
    })
    await page.goto('/?theme=glass&fx=full', { waitUntil: 'networkidle' })
    expect(await themeAttr(page)).toBe('glass') // 查询参数赢

    await page.locator('.tsw-trigger:visible').click()
    await page.locator('[role="menuitemradio"]:visible').first().click()
    expect(await themeAttr(page)).toBe('classic')
    // 存储里仍是原值 'classic'，没有被这次「带参数的访问」改写
    expect(await page.evaluate(() => localStorage.getItem('mzg_theme'))).toBe('classic')
  })

  test('非法主题值被忽略，不写入、不报错', async ({ page }) => {
    await stubApi(page)
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('/?theme=evil&fx=full', { waitUntil: 'networkidle' })
    expect(await themeAttr(page)).toBeNull()
    expect(errors).toEqual([])
  })
})
