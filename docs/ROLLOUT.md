# 上线 · 回滚 · 度量

> 面向要**关掉 glass 主题**、**统计两套主题使用率**、或**决定下一步做什么**的人。
> 机制见 [THEMING.md](./THEMING.md)，取舍依据见 [DECISIONS.md](./DECISIONS.md)。

---

## 1. 怎么回滚

改造分布在 7 个提交里（`6f4295c` → `196543a`），**全部在 `main` 上**。

```
196543a  test(qa): 质量保障与验收报告（阶段 7）
c1818af  feat(a11y,perf): 生产护栏（阶段 6）
51e8e78  feat(theme): 界面风格切换器（阶段 5）
600841b  test(visual): Playwright 截图基线 + 阶段 4 内页后台 glass 主题
d14a6fd  feat(theme): 首页 glass 主题（阶段 3）
6f4295c  chore: 冻结 classic 基线并建立三层 token 主题机制
```

有**两种粒度**的回滚，用途不同 —— 先想清楚要哪一种。

---

### 方案 A · 只关掉 glass 主题（推荐，保留 token 机制）

**用途**：glass 上线后观感/性能不达预期，先退回「只有 classic」的状态，但**保留** token 化带来的收益（可维护性、无障碍修复、storage 白屏修复、对比度修复）。

**改 3 处**：

| # | 文件 | 改动 |
|---|---|---|
| 1 | `frontend/src/composables/useTheme.js` | `THEME_CONFIG` 删掉 `glass` 那一项；同文件的 `readQueryOverride()` 正则去掉 `\|glass` |
| 2 | `frontend/index.html` | 内联脚本里的正则改成与上一步**逐字一致** |
| 3 | `frontend/src/views/WelcomeView.vue` | 删掉 `<GlassHome v-if="isGlass" />` 与 `const isGlass`（可选 —— 留着也不会有人能切到 glass）|

**不用改的**：`App.vue` 里的 `glass.css` / `glass-app.css` 导入可以原样保留。这两份文件的**全部规则**都限定在 `:root[data-theme="glass"]` 下，classic 页面上一条都不命中，唯一的代价是包体积。要彻底瘦身再删。

**然后**：`./deploy.sh`（会 `npm run build` 并 `pm2 reload`）。

#### ⚠ 回滚时最容易踩的坑

**只改 `THEME_CONFIG` 而不改正则** → `?theme=glass` 仍会把页面渲染成 glass，而切换器里已经没有这个选项，**用户切不回来**，且不报错。

已加护栏（`useTheme.js` 的 `readQueryOverride()` 现在会过一道 `isValid()`）：配置与正则不一致时，该查询参数被**忽略**而不是生效。所以即使漏改正则，也不会出现「切不回来」的死状态 —— 但分享出去的 `?theme=glass` 链接会静默失效。**两条正则请一起改。**

#### 已有用户的偏好怎么办

`localStorage.mzg_theme` 里可能存着 `'glass'`。`readStored()` 用 `isValid()` 校验，而 `isValid()` 读的是 `THEME_CONFIG` —— 所以只要 glass 从配置里摘掉，这些用户下次访问就会**自动回到 classic**，不需要清理存储。这是安全的。

---

### 方案 B · 全量回滚到改造前

**用途**：整个主题化改造被否决。

```bash
cd /www/wwwroot/miazhanggui.xyz
git revert --no-commit 6f4295c..196543a   # 六个提交一起撤销
git commit -m "revert: 回滚主题化改造"
./deploy.sh
```

**注意**：这会**连带撤销**阶段 6 / 7 中夹带的两个既存缺陷修复 —— 隐私模式下的**全应用白屏**（`storage.js`）与两处缺失的焦点环。回滚前请确认这两个修复不需要保留；若需要，改用方案 A。

---

### 方案 C · 隐藏入口但保留已选用户（需要小改动）

**用途**：不想让新用户看到切换器，但已经选了 glass 的用户保持原样。

当前架构**不支持**这个粒度 —— `THEME_CONFIG` 既是「切换器显示什么」也是「哪些值合法」。要实现需要给配置项加一个标记：

```js
// useTheme.js
{ key: 'glass', label: '玻璃', desc: '…', hint: '…', hidden: true }
```
```js
export const THEMES = THEME_CONFIG.map((t) => t.key)                       // 合法性：仍含 glass
export const VISIBLE_THEMES = THEME_CONFIG.filter((t) => !t.hidden)       // 切换器：过滤掉
```

然后 `ThemeSwitcher.vue` 遍历 `VISIBLE_THEMES`。约 5 行改动。

> 本轮**没有实施** —— 没有需求驱动，属于投机性设计。写在这里是因为它是回滚光谱上真实存在的一档。

---

## 2. 怎么统计两套主题的使用率

### 先说结论：**现在测不了，而且不加代码就永远测不了**

主题存在 `localStorage.mzg_theme` 里。这意味着：

- ❌ **nginx access log 看不到** —— 主题不在 URL 里（只有 `?theme=` 分享链接才在，那是极少数）
- ❌ **后端数据库里没有** —— 没有任何请求携带这个信息
- ❌ **不能复用 `/api/logs`** —— 那个端点需要**商家鉴权**（C 端访客根本调不通），而且写的是**商家操作日志**，塞进去就是数据污染

所以任何「看下日志就知道了」的想法都不成立。要度量就必须加一条客户端上报。

---

### 方案 1 · 加一个极轻量的统计端点（推荐）

**后端**：在 `backend/src/routes/` 下新增（**不要**动 `logRoutes.js`）：

```
POST /api/telemetry/theme     # 无鉴权（C 端访客要能调）
  body: { theme, source }     # source: 'boot' | 'switch'
  写入一张独立的单表：theme_events(theme, source, ts, ip_hash)
```

- **无鉴权**是必须的（C 端访客没有 token）—— 因此要加**限流**，否则会被刷
- **`ip_hash` 而非原始 IP**：只用于去重，不做个人识别
- 独立表、独立端点 —— 与商家操作日志**物理隔离**，互不污染

**前端**：接两处，都在已有钩子上，**不需要改 `useTheme.js`**：

```js
// 1) 切换时
window.addEventListener('theme:switch', (e) => {
  navigator.sendBeacon('/api/telemetry/theme',
    new Blob([JSON.stringify({ theme: e.detail.to, source: 'switch' })],
             { type: 'application/json' }))
})

// 2) 首屏时（代表存量偏好，不是切换行为）
navigator.sendBeacon('/api/telemetry/theme', /* { theme: 当前值, source: 'boot' } */)
```

`sendBeacon` 而不是 `fetch`：不阻塞、页面关闭也能发出去、失败无所谓。

**埋点绝不能影响主流程**：设备不支持 `sendBeacon`、网络失败、端点 500 —— 全部静默。主题切换本身不依赖上报成功。

**能算出什么**：
- `source='boot'` 的分布 = **存量偏好占比**（真正想要的「使用率」）
- `source='switch'` 的 `from→to` = **切换行为**，能看出 glass 是不是「试一下就走」
- 按天聚合能看出**留存**：切到 glass 的人一周后还在不在 glass

**代价**：一个后端端点 + 一张表 + 前端 10 行。半天工作量。

---

### 方案 2 · 零后端改造的近似值（现在就能用）

如果只想**粗看**，不动后端：

- **统计 `?theme=` 的访问量**：从 nginx access log 里 grep `theme=glass`，对比总量。但这只反映**分享链接的点击**，不等于偏好分布，**偏差极大**（愿意点别人分享的 glass 链接 ≠ 自己会选 glass）。
- **人工抽样**：找 10–20 个真实用户问。样本小但**定性判断够用** —— 尤其能拿到「为什么不用」这种日志永远给不出的信息。

**推荐**：先做方案 2 的人工抽样（当天就能做），拿到定性结论后再决定要不要投入方案 1。

---

### 方案 3 · 第三方分析工具

项目当前**没有任何分析工具**（已确认：无 gtag / 百度统计 / Sentry）。

若将来要接，**只需订阅现成的事件**，不用回来改 `useTheme.js`：

```js
window.addEventListener('theme:switch', (e) => {
  analytics.track('theme_switch', e.detail)   // { from, to }
})
```

这是当初把「派发事件」与「上报」分开的原因（见 [DECISIONS.md](./DECISIONS.md) D20）。

> ⚠️ 接第三方工具前请先确认**隐私合规**：上报任何用户标识都要有依据。方案 1 的 `ip_hash` 已经是能不做个人识别就不做的折中。

---

## 3. 下一步建议

按**性价比**排序。

### 建议 1 · 先做一轮真实设备验证（**最高优先**）

**为什么排第一**：阶段 7 的验收报告里，跨浏览器验证一栏原本是「❌ 未执行」。本轮已用 Playwright 补齐了**引擎级**证据：

| 引擎 | 结果 |
|---|---|
| Chromium 153 | 81 passed（含 58 张视觉基线）|
| Firefox 155 | 51 passed / 1 skipped |
| WebKit 26.6 | 51 passed / 1 skipped |

（1 skipped = `prefers-contrast` 用例，走 CDP，仅 Chromium 支持，非 Chromium 下主动跳过并给出提示）

**但这不等于真机验证**。Playwright WebKit 是引擎家族级别，**不是 iOS Safari 的合成器**。以下三件事**只有真机能测**：

1. **iOS Safari 滚动时的 `backdrop-filter` 性能** —— iOS 上比桌面敏感得多，这是最可能出问题的一项
2. **Safari 的滚动模糊闪烁/抖动**（已知坑，报告 §9.1 S3 列了现象与判定）
3. **地址栏收起/展开时的 `100dvh` 行为**

`验收报告.md` §9 已经写好了**具体要看什么**（不是「测一下」），照单执行即可。

---

### 建议 2 · 对「glass 设为默认」做 A/B 测试

**现状**：默认是 classic，glass 需要用户主动切换。这意味着 **glass 的实际曝光量取决于切换器的发现率**，而不是它的质量。

**建议做法**：
1. **先按建议 1 补齐真机验证** —— 默认主题出问题的代价比可选主题大得多
2. 接上度量（上面方案 1），确认当前 glass 的**自愿使用率**
3. 再做 A/B：新访客随机分配默认主题，比较**预约转化率**而不是「停留时长」

**为什么用转化率**：这是预约平台。停留久可能是「找不到东西」，不是「喜欢」。

**前置条件**：两套主题的**预约流程**必须都无阻碍。阶段 4 已确保预约流程「可读性优先」，但真机验证没过之前不建议动默认值。

---

### 建议 3 · 第三套主题：深色（可选）

**现状**：项目**不跟随**系统深色模式，这是有意的（见 [DECISIONS.md](./DECISIONS.md) D8）—— 商家后台不该某天打开变个样。

**建议**：如果要出深色主题，让它成为**用户显式选择的第三项**，而不是自动跟随。

**成本**：主要成本在**状态语义三元组的翻转**（`--color-*-tint` / `-ink`），而不是「把背景改黑」。`docs/THEMING.md` §2 已经给了完整的 `dark` 覆盖块草稿和验证步骤。

**但**：深色主题的最大收益场景是**商家后台夜间对账**，而后台是**不使用 `backdrop-filter`** 的（D2）—— 也就是说深色在后台是个纯配色工作，成本比 C 端低。若要做，**建议先后台后 C 端**。

**不建议现在做**：当前没有证据表明用户需要它。先做建议 1 和 2。

---

### 建议 4 · Lighthouse 绝对分值（独立立项）

**现状**：Performance 35 / LCP 8.3s。**两套主题持平**（差 +0.02s），不是主题化引入的。

**根因**：1MB JS 单包 + ~400KB CSS，Element Plus 占绝大部分。

**为什么不在本次做**：修它要动代码分割与 EP 按需引入，会大范围影响加载路径 —— 与「classic 零回归」的第一优先级冲突。混做的话一旦出回归就分不清是谁引入的。

**建议**：单独立项，按 ① `manualChunks` ② EP 按需引入 ③ 首屏最小样式内联 的顺序推进。

---

## 4. 上线检查清单

```
准备
[ ] 真机验证（报告 §9）已执行，Safari / iOS Safari 无阻断问题
[ ] node scripts/check-tokens.mjs   → classic 令牌零差异
[ ] node scripts/check-contrast.mjs → 全部达标
[ ] npx playwright test            → 全绿
[ ] 三引擎冒烟：chromium / firefox / webkit 全绿

发布
[ ] 确认在 main 分支、工作区干净
[ ] 记录当前 HEAD（回滚锚点）：git rev-parse HEAD
[ ] ./deploy.sh

发布后
[ ] 打开首页，切换器可见、可点、切换后刷新保持
[ ] 商家后台看一眼：确认是实色分层、无模糊、表格可读
[ ] 检查控制台无报错
[ ] 保留回滚窗口观察一段时间
```

**回滚触发条件（预先约定，避免临场争论）**：
- 出现任何**功能阻断**（页面打不开、按钮点不动）→ 立即回滚
- 出现**大面积观感问题**（字体糊、对比度不可读）→ 立即回滚
- 个别用户反馈「不好看」→ **不回滚**，记录下来留待 A/B 数据判断
