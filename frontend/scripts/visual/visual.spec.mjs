import { test, expect } from '@playwright/test'

/**
 * 视觉回归 spec
 *
 * 用法见 playwright.config.mjs 顶部注释。两条环境变量：
 *   DIST_DIR —— 要测哪一份构建产物（绝对路径）
 *   THEME    —— classic | glass，决定注入的 localStorage 主题
 *
 * 所有不确定性来源都在这里被钉死：时间、API 数据、字体、动画、视口。
 * 任何一条没钉住，回来的就是随机失败 —— 而随机失败的截图基线等于没有基线。
 */

const THEME = process.env.THEME || 'classic'
const DIST = process.env.DIST_DIR || '(未指定)'

/* ───────── 固定夹具 ─────────
   形状取自各页面实际读取的字段。刻意不用真实接口：
   线上数据每天都在变，用真数据做的基线第二天就会全红。 */
const STUDIOS = [
  { id: 1, mId: 'shop_demo', title: '杭州AD06场照', city: '杭州', coverUrl: null,
    singlePrice: 500, packagePrice: 1280, depositRatio: 30, isStyleEnabled: true,
    description: '日系写真 · 棚拍 / 外景', baseStartTime: '09:00', baseEndTime: '18:00' },
  { id: 2, mId: 'shop_demo', title: '上海静安影像馆', city: '上海', coverUrl: null,
    singlePrice: 680, packagePrice: 1980, depositRatio: 30, isStyleEnabled: false,
    description: '专业棚拍 · 多场景切换', baseStartTime: '10:00', baseEndTime: '20:00' },
  { id: 3, mId: 'shop_demo', title: '北京朝阳写真工作室', city: '北京', coverUrl: null,
    singlePrice: 420, packagePrice: 999, depositRatio: 50, isStyleEnabled: false,
    description: '轻写真 · 快拍快修', baseStartTime: '09:30', baseEndTime: '17:30' },
  { id: 4, mId: 'shop_demo', title: '成都太古里摄影空间', city: '成都', coverUrl: null,
    singlePrice: 560, packagePrice: 1580, depositRatio: 30, isStyleEnabled: true,
    description: '城市街拍 · 胶片质感', baseStartTime: '08:00', baseEndTime: '19:00' },
]

const ORDERS = [
  { id: 1, orderNo: 'ord_1780255461_c51f83', mId: 'shop_demo', studioId: 1, studioTitle: '杭州AD06场照',
    bookingDate: '2026-09-20', bookingStartTime: '09:30:00', bookingEndTime: '10:30:00',
    roleName: '和风少女', totalPrice: 1280, depositAmount: 384, addonTotal: 0,
    status: '已付定金', lockStatus: 'hard_lock', lock_status: 'hard_lock',
    contact: '13800000001', contactNote: '希望多拍侧脸', optType: 'single', opt_type: 'single',
    characterImage: null, referenceImages: [], createdAt: '2026-09-18 09:12:00',
    created_at: '2026-09-18 09:12:00', date: '2026-09-20' },
  { id: 2, orderNo: 'ord_1780255462_a72d19', mId: 'shop_demo', studioId: 2, studioTitle: '上海静安影像馆',
    bookingDate: '2026-09-21', bookingStartTime: '14:00:00', bookingEndTime: '16:00:00',
    roleName: '都市通勤', totalPrice: 1980, depositAmount: 594, addonTotal: 120,
    status: '待支付', lockStatus: 'pre_lock', lock_status: 'pre_lock',
    contact: '13800000002', contactNote: '', optType: 'package', opt_type: 'package',
    characterImage: null, referenceImages: [], createdAt: '2026-09-18 10:20:00',
    created_at: '2026-09-18 10:20:00', date: '2026-09-21' },
  { id: 3, orderNo: 'ord_1780255463_bb03fe', mId: 'shop_demo', studioId: 3, studioTitle: '北京朝阳写真工作室',
    bookingDate: '2026-09-18', bookingStartTime: '11:00:00', bookingEndTime: '12:00:00',
    roleName: '国风', totalPrice: 999, depositAmount: 500, addonTotal: 0,
    status: '已结清', lockStatus: 'hard_lock', lock_status: 'hard_lock',
    contact: '13800000003', contactNote: '', optType: 'single', opt_type: 'single',
    characterImage: null, referenceImages: [], createdAt: '2026-09-10 16:40:00',
    created_at: '2026-09-10 16:40:00', date: '2026-09-18' },
]

const json = (route, data) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, code: 0, data }) })

/** 所有 /api/** 请求的固定应答。未列出的端点一律返回空数组 —— 页面会走空状态，
    而空状态本身也是这一轮要验收的视觉。 */
async function stubApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/studios-lite')) return json(route, STUDIOS)
    if (url.includes('/studios-cities')) return json(route, ['杭州', '上海', '北京', '成都'])
    if (url.includes('/studios/available')) return json(route, STUDIOS)
    if (url.includes('/order-stats')) return json(route, { total: 3, pending: 1, confirmed: 1, completed: 1 })
    if (url.includes('/api/orders?')) return json(route, { list: ORDERS, total: 3, page: 1, pageSize: 100 })
    if (url.includes('/api/orders/')) return json(route, ORDERS[0])
    if (url.includes('/booked-times')) return json(route, [])
    if (url.includes('/notifications/unread')) return json(route, { count: 0 })
    if (url.includes('/settings')) return json(route, { announcement: '' })
    return json(route, [])
  })
}

const ROUTES = [
  { name: '01-home', path: '/', c: true },
  { name: '02-filter', path: '/studio-filter', c: true },
  { name: '03-studios', path: '/studios', c: true },
  { name: '04-studio-detail', path: '/studios/1', c: true },
  { name: '05-styles', path: '/styles', c: true },
  { name: '06-booking-step1', path: '/booking/1?mId=shop_demo', c: true },
  { name: '07-booking-step2', path: '/booking/1/step2?mId=shop_demo', c: true },
  { name: '08-my-orders', path: '/my-orders', c: true },
  { name: '09-order-detail', path: '/my-orders/1', c: true },
  { name: '10-client-login', path: '/login', c: true },
  // 不带 token —— 否则路由守卫会把 /admin/login 重定向到 /admin/orders
  { name: '11-admin-login', path: '/admin/login', admin: false },
  { name: '12-admin-orders', path: '/admin/orders', admin: true },
  { name: '13-admin-styles', path: '/admin/styles', admin: true },
  { name: '14-admin-settings', path: '/admin/settings', admin: true },
  { name: '15-admin-dashboard', path: '/admin/dashboard', admin: true },
  { name: '16-admin-notifications', path: '/admin/notifications', admin: true },
  { name: '17-admin-logs', path: '/admin/logs', admin: true },
  { name: '18-admin-create', path: '/admin/studio/create/step1', admin: true },
  { name: '19-admin-edit', path: '/admin/studio/edit/1', admin: true },
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, desktopOnly: false },
  { name: 'mobile', width: 390, height: 844, desktopOnly: false },
]

for (const vp of VIEWPORTS) {
  for (const r of ROUTES) {
    // 移动端只截 C 端：后台是商家在桌面用的，小屏后台的视觉优先级低，
    // 全量截会让基线数量翻倍而信息量很少
    if (vp.name === 'mobile' && !r.c) continue

    test(`${THEME} · ${r.name} · ${vp.name}`, async ({ page, context }) => {
      test.skip(!DIST || DIST === '(未指定)', '未指定 DIST_DIR')

      await page.setViewportSize({ width: vp.width, height: vp.height })
      // 冻结时间：排期日历、默认日期、相对时间都依赖 new Date()
      await page.clock.setFixedTime(new Date('2026-09-18T10:00:00+08:00'))

      await context.addInitScript(
        ([theme, asAdmin]) => {
          try {
            localStorage.setItem('mzg_theme', theme)
            if (asAdmin) {
              localStorage.setItem('mzg_admin_token', 'visual-regression-token')
              localStorage.setItem('mzg_admin_mid', 'shop_demo')
              localStorage.setItem('mzg_admin_shopname', '喵掌柜演示店')
            } else {
              localStorage.removeItem('mzg_admin_token')
            }
          } catch (e) {}
        },
        [THEME, r.admin === true]
      )

      await stubApi(page)

      // fx=full：强制满效果。
      // 跑 CI 的机器核数往往很少（本机 2 核），低端启发式会一律判成降级，
      // 于是基线记录的全是降级态 —— 而我们要冻结的是**设计本身的**外观。
      // 降级态另有专门的功能测试覆盖（见 switcher.spec.mjs 的 fx 用例）。
      const url = r.path + (r.path.includes('?') ? '&' : '?') + 'fx=full'
      await page.goto(url, { waitUntil: 'networkidle' })
      // 字体就绪后再截：无 Inter 时回退字体在容器内是一致的，
      // 但字体加载完成的时机不同会让文字宽度抖动
      await page.evaluate(() => document.fonts.ready)
      // 让 Vue 的过渡与图片解码各走完一轮
      await page.waitForTimeout(400)

      await expect(page).toHaveScreenshot([THEME, `${r.name}--${vp.name}.png`], {
        fullPage: true,
      })
    })
  }
}
