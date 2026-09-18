import { test, expect } from '@playwright/test'

/**
 * 主题切换器的行为测试（键盘 / ARIA / 持久化 / View Transitions）
 *
 * 为什么放在视觉测试目录：它用的是同一套 Playwright 配置与同一个静态服务器，
 * 单独建一份配置只会多一处要维护的东西。它不是视觉断言，但同样属于
 * 「改主题相关代码后必须跑」的那一类。
 *
 * 运行：DIST_DIR=/tmp/mz-dist-p5 npx playwright test switcher
 *
 * 注意：这个 spec 需要**真实点击**，所以不能沿用 playwright.config.mjs 里
 * 全局的 reducedMotion: 'reduce' —— 那样就测不到 View Transition 分支了。
 * 相关用例自己覆盖 context 的偏好。
 */

const DIST = process.env.DIST_DIR || '(未指定)'

async function setup(page, { theme = 'classic', reducedMotion = null } = {}) {
  if (reducedMotion) await page.emulateMedia({ reducedMotion })
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('mzg_theme', t)
      // 记录切换事件，供断言读取
      window.__switches = []
      window.addEventListener('theme:switch', (e) => window.__switches.push(e.detail))
    } catch (e) {}
  }, theme)
  await page.route('**/api/**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, code: 0, data: [] }),
    })
  )
}

/* `/` 上同时挂载两个切换器实例（WelcomeView 的浮动入口 + GlassHome 导航条里的），
   按主题显示其中一个、另一个 display:none。所以定位一律用 :visible ——
   不带过滤的定位器会命中两个，Playwright 会直接以 strict mode 报错。 */
const trigger = (page) => page.locator('.tsw-trigger:visible')
const panel = (page) => page.locator('#tsw-menu')
const options = (page) => page.locator('[role="menuitemradio"]:visible')

test.describe('主题切换器', () => {
  test.skip(!DIST || DIST === '(未指定)', '未指定 DIST_DIR')

  test('ARIA 结构：触发器是链接且带 menu 语义', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    const t = trigger(page)
    await expect(t).toHaveAttribute('aria-haspopup', 'menu')
    await expect(t).toHaveAttribute('aria-expanded', 'false')
    await expect(t).toHaveAttribute('aria-controls', 'tsw-menu')
    // 渐进增强：无 JS 时它是真链接
    await expect(t).toHaveAttribute('href', /\?theme=/)
    await expect(panel(page)).toHaveCount(0)
  })

  test('点击打开：aria-expanded 变 true，面板为 role=menu', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    await trigger(page).click()
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(panel(page)).toHaveAttribute('role', 'menu')
    await expect(options(page)).toHaveCount(2)
    await expect(options(page).first()).toHaveAttribute('aria-checked', 'true') // classic
  })

  test('键盘：↓ 打开并聚焦第一项，方向键移动，Enter 选中', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    const t = trigger(page)
    await t.focus()

    await page.keyboard.press('ArrowDown')
    await expect(panel(page)).toBeVisible()
    // 第一项（经典，当前已选）应获得焦点
    await expect(options(page).first()).toBeFocused()

    await page.keyboard.press('ArrowDown')
    await expect(options(page).nth(1)).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(options(page).first()).toBeFocused()

    // Home / End
    await page.keyboard.press('End')
    await expect(options(page).nth(1)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(options(page).first()).toBeFocused()

    // 选中第二项
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(panel(page)).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('glass')
    expect(await page.evaluate(() => localStorage.getItem('mzg_theme'))).toBe('glass')
    // 焦点归还触发器
    await expect(t).toBeFocused()
  })

  test('键盘：↑ 从末尾打开（菜单惯例）', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    await trigger(page).focus()
    await page.keyboard.press('ArrowUp')
    await expect(options(page).nth(1)).toBeFocused()
  })

  test('键盘：Space 选中', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    await trigger(page).focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press(' ')
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('glass')
  })

  test('键盘：Esc 关闭并把焦点还给触发器', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    const t = trigger(page)
    await t.focus()
    await page.keyboard.press('ArrowDown')
    await expect(panel(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel(page)).toHaveCount(0)
    await expect(t).toBeFocused()
    // 未改变主题
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('classic')
  })

  test('键盘：Tab 关闭但**不**抢回焦点', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    await trigger(page).focus()
    await page.keyboard.press('ArrowDown')
    await expect(panel(page)).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(panel(page)).toHaveCount(0)
    // 焦点应停在触发器之后的某个元素上，而不是被拉回触发器
    await expect(trigger(page)).not.toBeFocused()
  })

  test('点击外部关闭', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    await trigger(page).click()
    await expect(panel(page)).toBeVisible()
    await page.locator('body').click({ position: { x: 5, y: 400 } })
    await expect(panel(page)).toHaveCount(0)
  })

  test('aria-checked 随主题变化，且同时只能有一个 true', async ({ page }) => {
    await setup(page, { theme: 'glass' })
    await page.goto('/')
    await trigger(page).click()
    await expect(options(page).nth(1)).toHaveAttribute('aria-checked', 'true')
    await expect(options(page).first()).toHaveAttribute('aria-checked', 'false')
    await options(page).first().click()
    await trigger(page).click()
    await expect(options(page).first()).toHaveAttribute('aria-checked', 'true')
    await expect(options(page).nth(1)).toHaveAttribute('aria-checked', 'false')
  })

  test('派发 theme:switch 事件（供将来接入分析用）', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    await trigger(page).click()
    await options(page).nth(1).click()
    expect(await page.evaluate(() => window.__switches)).toEqual([{ from: 'classic', to: 'glass' }])
  })

  test('迷你预览用的是各主题的真实令牌值，且两者不同', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    await trigger(page).click()
    const vars = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.tsw-preview'))
      return els.map((el) => ({
        bg: el.style.getPropertyValue('--pv-bg').trim(),
        brand: el.style.getPropertyValue('--pv-brand').trim(),
      }))
    })
    expect(vars).toHaveLength(2)
    expect(vars[0].bg).toBe('#F9F8F6') // classic --bg-base
    expect(vars[0].brand).toBe('#E8635C') // classic --color-primary
    expect(vars[1].bg).toBe('#F7FAFF') // glass --bg-base
    expect(vars[1].brand).toBe('#2563EB') // glass --color-primary
  })

  test('reduced-motion：不启动 View Transition，但主题照常切换', async ({ page }) => {
    await setup(page, { reducedMotion: 'reduce' })
    await page.goto('/')
    // 记录是否调用了 startViewTransition
    await page.evaluate(() => {
      window.__vtCalls = 0
      const orig = document.startViewTransition
      document.startViewTransition = function (...a) {
        window.__vtCalls++
        return orig.apply(this, a)
      }
    })
    await trigger(page).click()
    await options(page).nth(1).click()
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('glass')
    expect(await page.evaluate(() => window.__vtCalls)).toBe(0)
  })

  test('支持时调用 View Transition，且 DOM 变更在回调内（不产生白闪）', async ({ page }) => {
    // 必须显式覆盖：playwright.config.mjs 全局设了 reducedMotion: 'reduce'
    // （为了让视觉截图稳定），而那条偏好下组件会**故意**跳过 View Transition。
    // 不覆盖的话这条用例永远测不到目标分支。
    await setup(page, { reducedMotion: 'no-preference' })
    // 再叠一层 ?fx=full：配置文件全局设了 reducedMotion: 'reduce'，
    // 单靠 page.emulateMedia 覆盖在 WebKit 上不稳定，
    // 而 ?fx=full 是明确的「强制满效果」开关，跨引擎行为一致。
    await page.goto('/?fx=full')
    await page.evaluate(() => {
      window.__vtCalls = 0
      window.__vtThemeInside = null
      const orig = document.startViewTransition
      document.startViewTransition = function (cb) {
        window.__vtCalls++
        // 包一层：在回调执行的瞬间记录当时的 data-theme，
        // 用来证明「DOM 变更发生在快照拍摄之后」，即没有先清空再填
        const wrapped = () => {
          cb()
          window.__vtThemeInside = document.documentElement.dataset.theme
        }
        return orig.call(this, wrapped)
      }
    })
    await trigger(page).click()
    await options(page).nth(1).click()
    await expect.poll(() => page.evaluate(() => window.__vtCalls)).toBe(1)
    expect(await page.evaluate(() => window.__vtThemeInside)).toBe('glass')
  })

  test('查询参数覆盖：?theme 生效且切换不写入 localStorage', async ({ page }) => {
    await setup(page, { theme: 'classic' })
    await page.goto('/?theme=glass')
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('glass')
    await trigger(page).click()
    // 被 URL 固定时应给出提示
    await expect(page.locator('.tsw-forced')).toBeVisible()
    await options(page).first().click()
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('classic')
    // 关键：没有落盘
    expect(await page.evaluate(() => localStorage.getItem('mzg_theme'))).toBe('classic')
  })

  /**
   * 回归：切换后**当次会话内**切换器状态必须立刻跟上，不能等刷新。
   *
   * 这个缺陷曾真实漏到线上：commit() 把 `current = theme` 放进了
   * startViewTransition 的异步回调，而 setTheme 里的 notify() 是同步调的。
   * 从 classic 切到 glass 时，Vue 会在这中间完成一次渲染 ——
   * GlassHome 挂载、它内部的 ThemeSwitcher 首次 useTheme() 读到**过期的** current，
   * 于是页面已经是 glass，导航条却仍显示「经典」，直到刷新才恢复。
   *
   * 既有用例覆盖不到它：那些用例的起点/终点都让切换器**复用已挂载的实例**
   * （其 ref 已被 notify 更新过）。只有 classic → glass 会新建实例去读 current，
   * 而且必须走 View Transition 分支才会暴露（reduced-motion 下 current 是同步改的）。
   */
  test('回归：走 View Transition 时，新挂载的切换器也要立刻反映新主题', async ({ page }) => {
    await setup(page, { theme: 'classic' })
    // 配置文件全局设了 reducedMotion: 'reduce'，?fx=full 才是明确的「强制满效果」开关
    await page.goto('/?fx=full')
    await expect(page.locator('.welcome')).toHaveCount(1)

    await trigger(page).click()
    await options(page).nth(1).click() // classic → glass

    // 页面确实切到了 glass
    await expect(page.locator('.gh')).toHaveCount(1)
    // 且**导航条里那个刚挂载的**切换器立刻就是 glass 状态（这条断言可重试，
    // 缺陷存在时会一直不满足直到超时 —— 这就是回归信号）
    await expect(trigger(page)).toContainText('玻璃')

    await page.waitForTimeout(600) // 等 View Transition 结束再点，避免点到快照层
    await trigger(page).click()
    await expect(options(page).nth(1)).toHaveAttribute('aria-checked', 'true')
    await expect(options(page).first()).toHaveAttribute('aria-checked', 'false')
  })

  test('移动端浮层内有同一个组件，且带「恢复默认」', async ({ page }) => {
    await setup(page, { theme: 'glass' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.locator('.gh-nav__burger').click()
    const sheetSwitcher = page.locator('.tsw--sheet')
    await expect(sheetSwitcher).toBeVisible()
    // 与导航条里是同一个组件（同一套 DOM 结构），只是 variant 不同
    await expect(page.locator('.tsw:visible')).toHaveCount(2)
    await sheetSwitcher.locator('.tsw-trigger').click()
    await expect(page.locator('.tsw-reset')).toBeVisible()
    // 恢复默认：清存储 + 回默认主题
    await page.locator('.tsw-reset').click()
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('classic')
    expect(await page.evaluate(() => localStorage.getItem('mzg_theme'))).toBeNull()
  })
})
