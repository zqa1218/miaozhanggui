import { defineConfig } from '@playwright/test'

/**
 * 视觉回归配置
 *
 * 工作方式：同一个 spec 跑两份产物、按环境变量切换。
 *   1) 存基线（改造前的产物）：
 *        DIST_DIR=/tmp/mz-dist-before THEME=classic npx playwright test --update-snapshots
 *   2) 比对（改造后的产物，classic）—— 必须 0 差异，这就是「classic 零回归」的像素级证据：
 *        DIST_DIR=/tmp/mz-dist-p5 THEME=classic npx playwright test
 *   3) 存 glass 基线（新增基线，不是回归对象）：
 *        DIST_DIR=/tmp/mz-dist-p5 THEME=glass npx playwright test --update-snapshots
 *
 * 稳定性措施（少任何一条都会得到随机失败）：
 *   · deviceScaleFactor 固定 1 —— 否则不同机器 DPR 不同，图幅就不一样
 *   · reducedMotion: reduce —— theme.css 会把所有过渡压到 .01ms，
 *     动画不再影响截图时机。两份产物都有这条规则，所以可比
 *   · colorScheme: light —— classic 没设 color-scheme，若宿主是暗色偏好，
 *     原生控件（滚动条、日期选择器）会变样，两次跑就不一致了
 *   · 时区/语言固定 —— 日期格式与周起始日都会变
 *   · 时间在 spec 里用 page.clock 冻结 —— 排期日历、默认日期都依赖 new Date()
 *   · API 全部走 route 拦截的固定夹具 —— 真实数据的每次变化都会造成假失败
 *   · animations: 'disabled' —— 双保险
 */
export default defineConfig({
  testDir: './scripts/visual',
  snapshotDir: './scripts/visual/__screenshots__',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],

  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 0,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  use: {
    baseURL: 'http://127.0.0.1:4173',
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'off',
    screenshot: 'off',
  },

  webServer: {
    command: 'node scripts/visual/serve.mjs',
    port: 4173,
    reuseExistingServer: false,
    stdout: 'pipe',
    env: { DIST_DIR: process.env.DIST_DIR || '' },
  },
})
