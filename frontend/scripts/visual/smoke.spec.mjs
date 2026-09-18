import { test, expect } from '@playwright/test'

/**
 * 跨引擎冒烟：只验「能不能正常渲染」，不做像素比对。
 *
 * 为什么不给 Firefox 也建一套视觉基线：
 *   两个引擎的字形渲染、子像素抗锯齿、滚动条宽度都不同，逐像素基线在
 *   另一个引擎上必然大批失败，只能各存一套 —— 那会让基线数量与仓库体积翻倍，
 *   而它能多发现的问题（布局塌陷、元素缺失）用冒烟断言同样能发现。
 *   真正需要逐像素验证的跨引擎差异（Safari 的模糊闪烁等）必须在真机上人眼判断，
 *   自动化基线帮不上忙。
 *
 * 用法：DIST_DIR=<产物> npx playwright test --browser=firefox smoke
 */

const DIST = process.env.DIST_DIR || '(未指定)'

const ROUTES = [
  { path: '/', root: '.welcome, .gh' },
  { path: '/studio-filter', root: '.filter-page' },
  { path: '/studios', root: '.studio-list' },
  { path: '/studios/1', root: '.studio-detail' },
  { path: '/booking/1?mId=shop_demo', root: '.c-step1, .page' },
  { path: '/my-orders', root: '.page, .my-orders' },
  { path: '/login', root: '.client-login-page, .login-box' },
  { path: '/admin/login', root: '.login-box' },
  { path: '/admin/orders', root: '.dashboard' },
  { path: '/admin/dashboard', root: '.dashboard' },
]

test.describe('跨引擎冒烟', () => {
  test.skip(!DIST || DIST === '(未指定)', '未指定 DIST_DIR')

  for (const theme of ['classic', 'glass']) {
    for (const r of ROUTES) {
      test(`${theme} · ${r.path}`, async ({ page }) => {
        const problems = []
        page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`))
        page.on('console', (m) => {
          if (m.type() === 'error') problems.push(`[console.error] ${m.text()}`)
        })

        // 登录页不能带 token —— 路由守卫会把它重定向到 /admin/orders
        const asAdmin = r.path !== '/admin/login'
        await page.addInitScript(
          ([t, admin]) => {
            try {
              localStorage.setItem('mzg_theme', t)
              if (admin) {
                localStorage.setItem('mzg_admin_token', 'smoke-token')
                localStorage.setItem('mzg_admin_mid', 'shop_demo')
              } else {
                localStorage.removeItem('mzg_admin_token')
              }
            } catch (e) {}
          },
          [theme, asAdmin]
        )
        await page.route('**/api/**', (r2) =>
          r2.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, code: 0, data: [] }),
          })
        )

        await page.goto(r.path + (r.path.includes('?') ? '&' : '?') + 'fx=full', {
          waitUntil: 'networkidle',
        })
        // 根容器必须存在 —— 布局塌陷或组件崩溃会在这里被抓住
        await expect(page.locator(r.root).first()).toBeVisible()
        // 页面不应是空白
        const len = await page.evaluate(() => document.body.innerText.trim().length)
        expect(len, '页面正文为空').toBeGreaterThan(10)
        expect(problems, `控制台异常：\n${problems.join('\n')}`).toEqual([])
      })
    }
  }
})
