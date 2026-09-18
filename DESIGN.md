# Design

视觉系统记录。所有数值的唯一真源是 `frontend/src/assets/styles/tokens.primitives.css`
（原子值）与 `tokens.semantic.css`（语义值），本文档是它们的说明与决策依据。
改样式前先读这里，不要在组件里写死数值。

> 主题化改造进行中：`classic`（现有视觉，逐像素冻结）与 `glass`（品牌蓝）
> 两套语义层已就位，通过 `<html data-theme>` 切换。三层 token 的分工见
> `tokens.semantic.css` 文件头。

## Theme

日系珊瑚红 · 中度磨砂半透明。工具型界面（商家后台 + 顾客自助下单），
设计服务于功能：可读性、操作效率优先，装饰克制。

主题色为珊瑚红 `#E8635C`。

## Color

### 品牌色

| Token | 值 | 对比度 | 用途 |
|---|---|---|---|
| `--color-primary` | `#E8635C` | 3.30:1 | 填充 / 图形 / 边框 / 高亮。**禁止作正文色** |
| `--color-primary-light` | `#EC7F79` | — | 渐变浅端、装饰图形 |
| `--color-primary-dark` | `#BE514B` | 4.70:1 | 中大型装饰图标（≥24px） |
| `--color-primary-ink` | `#A83A32` | **6.33:1** | **白底上的珊瑚色文字，唯一合法取值** |
| `--color-primary-tint` | `#FDF3F2` | — | 浅底（hover、chip、选中态） |
| `--color-primary-gradient` | `linear-gradient(135deg,#E8635C,#EC7F79)` | — | 主按钮、选中态填充 |
| `--text-on-primary` | `#38140E` | **5.00:1** | **珊瑚底上的文字** |

> **关键决策**：珊瑚红是浅色（相对亮度 0.27），白字压在上面只有 3.30:1。
> 所以改的是**字色**而非底色 —— 珊瑚实底 + 深暖墨字。
> 这一个决定同时解决了全站所有主按钮、选中日期、选中态徽章的对比度问题。

### 状态语义（tint 底 + ink 字）

原体系每个状态只有一个浅色值，被同时当作填充和文字，导致「订单金额」「拒绝原因」
这类关键文字只有 1.3–1.9:1。现拆为三元组：

| 语义 | 填充 | 浅底 | 文字 | 文字对比度 |
|---|---|---|---|---|
| 成功 | `#A8D8B9` | `#EDF6F0` | `#3E6B4E` | 6.14:1 |
| 警告 | `#F9E0A0` | `#FEF9ED` | `#8A6420` | 5.35:1 |
| 危险 | `#C0392B` | `#FBEBE9` | `#9A2E22` | 7.53:1 |
| 信息 | `#A9C1D9` | `#F0F4F8` | `#4A6B8A` | 5.58:1 |
| 中性 | `#D4CFC8` | `#F4F2EE` | `#6B6560` | 5.74:1 |

### 文字层级

| Token | 值 | 对比度 | 用途 |
|---|---|---|---|
| `--text-1` | `#4A4642` | 9.35:1 | 标题 / 强调 / 数据值 |
| `--text-2` | `#6B6560` | 5.74:1 | 正文 |
| `--text-3` | `#756E69` | 5.01:1 | 次要说明 / 标签 / 元信息 / 占位符 |
| `--text-4` | `#9A938C` | 3.03:1 | **仅限 disabled 与装饰图形**，禁止承载可读文案 |
| `--text-inverse` | `#FFFFFF` | — | 深色底（遮罩、灯箱、深色徽章）上的文字 |

保持中性暖灰不引入新色相；暖调由主色与背景承担。

### 表面（中度磨砂）

| Token | 值 | 用途 |
|---|---|---|
| `--surface-1` | `rgba(255,255,255,.82)` | 主面板 / 卡片（主力档） |
| `--surface-2` | `rgba(255,255,255,.92)` | 吸顶吸底条 + 文字密集面 |
| `--surface-3` | `rgba(255,255,255,.68)` | 次级浮层（该档上禁止用 `--text-3` 及更浅的字） |
| `--surface-solid` | `#FFFFFF` | 二维码、图片容器等必须不透明处 |
| `--glass-blur` | `saturate(150%) blur(20px)` | 配合 surface-1/2 |
| `--glass-hairline` | `rgba(74,70,66,.07)` | 磨砂面板的外描边 |
| `--glass-highlight` | `inset 0 1px 0 rgba(255,255,255,.55)` | 玻璃上沿高光 |

**两条硬规则：**

1. **只在「内容会从它下面滚过去」的元素上用 `backdrop-filter`** —— 吸顶导航、吸底 tab、
   弹窗、popover。一屏 ≤6 个。
2. **宫格/列表项卡片一律不加 `backdrop-filter`**。一屏 20 张卡 = 20 次离屏模糊，移动端必掉帧。
   半透明由 `--surface-1` 的 alpha 合成提供，GPU 成本为零。

**降级**：`@supports not (backdrop-filter)` 与 `prefers-reduced-transparency: reduce`
时，表面自动提到 `.96–.98`。做在**变量层**，所有引用方自动跟随。

## Typography

- 字族：`Inter` + 系统中文字体回退（`PingFang SC` / `Microsoft YaHei`）。单一字族，靠字重分层。
- 字号梯度：11 / 12 / 13 / 14 / 15 / 16 / 20 / 22 / 24 / 48px。
- 行高 1.6（正文）/ 1.3（标题）。
- 字距 `letter-spacing: .02em` 全局；标题 2px。
- 数字与时间用 `--font-mono`（订单号、时间轴、金额对齐）。

## Radius

原体系 8/10/12/14/16/18/20/24/26/28/32/36 十二种散值共存，266 处声明只有 14 处用变量。
现收敛为 6 档：

| Token | 值 | 用途 |
|---|---|---|
| `--radius-xs` | 6px | 复选标记 / 色块 |
| `--radius-sm` | 8px | 缩略图 / 小标签 |
| `--radius-md` | 12px | 输入框 / 下拉 / 表格单元 |
| `--radius-lg` | 16px | **卡片 / 面板封顶** |
| `--radius-xl` | 20px | 弹窗 / 抽屉 |
| `--radius-pill` | 9999px | **按钮 / 状态标签 / 头像** |

胶囊按钮（`--radius-btn` → `--radius-pill`）是这套日系主题的识别特征，予以保留。
要全站改成圆角矩形，只需把 `--radius-btn` 改成 `var(--radius-md)` 一个值。

## Shadow

3 级，暖褐 `rgba(74,70,66,…)` 而非纯黑 —— 纯黑阴影落在米白底上会发灰发脏。

| Token | 用途 |
|---|---|
| `--shadow-1` | 静置卡片 |
| `--shadow-2` | hover / 浮起 |
| `--shadow-3` | 弹窗 / 下拉 |
| `--shadow-primary` | 珊瑚主按钮 |
| `--shadow-glow` | focus ring（原为 28px 光晕，已收敛） |

## Motion

- 曲线：`--ease-out: cubic-bezier(.16,1,.3,1)`（expo-out）。
  **已移除回弹曲线 `cubic-bezier(.34,1.56,.64,1)`** —— 在需要反复操作的表格和按钮上是干扰。
- 时长：120ms（颜色/边框）/ 200ms（位移/阴影）/ 320ms（面板进入）。
- 移除 hover 的 `scale()` 缩放，改为纯 `translateY(-1px~-3px)` + 阴影变化。
- `@media (prefers-reduced-motion: reduce)` 全局降级（此前全站缺失）。

## Layout

| Token | 值 | 用途 |
|---|---|---|
| `--w-form` | 560px | C 端线性流程（下单、订单详情） |
| `--w-read` | 760px | 单列表单 / 设置 / 创建向导 |
| `--w-wide` | 1200px | 后台订单 / 列表 / 宫格 |
| `--gutter` / `--gutter-mobile` | 24px / 12px | 页面留白 |

容器类 `.page` + `.page--form` / `.page--read` / `.page--wide`。
原体系 520/600/640/700/780/800/900/1200/1280 九种宽度并存，用户在后台连续翻页会看到
内容宽度跳 4 次；7 处还是行内 `style="max-width:520px"`（主题层覆盖不到），已全部迁移。

## z-index

```
--z-base: 0  ·  --z-raised: 10  ·  --z-sticky: 100  ·  --z-overlay: 1500  ·  --z-toast: 1900
```
**自定义层必须低于 Element Plus 的弹层（2000 起）**，否则会出现「弹窗被自己的遮罩盖住」。

## Components

### 按钮

| 类名 | 语义 | 尺寸 |
|---|---|---|
| `.btn--primary` / `.btn-primary` | 页面主操作（每屏最多一个） | 36px |
| `.btn--secondary` / `.btn-secondary` | 常规操作 | 36px |
| `.btn--ghost` | 低权重（取消/返回/表格行内） | 36px |
| `.btn--danger` / `.btn-danger` | 破坏性操作 | 36px |
| `.btn--success` / `.btn-success` | 确认/完成 | 36px |
| `.btn--sm` / `.btn-sm` | 小尺寸 | 30px（8px 圆角） |
| `.btn--lg` | 大尺寸 | 44px |
| `.btn--block` | 撑满容器 | — |

旧类名保留为别名（模板里约 19 处引用），新代码请写 `.btn--*`。
**任何页面都不要再 scoped 覆盖这些类** —— 这是本轮修复的核心问题：
原先 `.btn-primary` 有 7 份互相覆盖的定义，同一个主按钮在不同页面 padding 各不相同。

卡片、面板、表单、徽章、表格统一由 `theme.css` 提供。

## 文件职责

| 文件 | 职责 |
|---|---|
| `tokens.primitives.css` | **L1 原语**：色阶/间距/字号/圆角/时长/缓动/层级。永不随主题变。只允许 `:root` 声明 |
| `tokens.semantic.css` | **L2 语义** + `classic` 快照 + `glass` 覆盖 + 降级块。只允许变量声明（唯一例外是 glass 的 body 背景装饰） |
| `element-override.scss` | Element Plus 编译期 SCSS 变量（色阶/尺寸/内边距/圆角/阴影） |
| `element-bridge.css` | **唯一**允许出现 `--el-*` 和 `.el-*` 覆盖的地方 |
| `theme.css` | 语义组件层（按钮/面板/徽章/容器/动效） |
| `global.css` | 页面级构件与历史兼容类 |

L3 组件层**暂不建立**：`.panel` / `.glass-card` / `.stat-card` 的复用已由
`theme.css` 的类组合表达，再抽 `--panel-bg` 只增加中间层而不减少重复。
出现「同一组件样式需按主题给出不同配方」的真实需求时再建。

加载顺序即优先级（见 `App.vue`）：primitives → semantic → element-bridge → theme → global。
这五份在 element-plus 自身样式之后加载，同权重选择器本就能赢，无需依赖 `!important`。

**主题快照的取法**（重要）：`:root` 与 `:root[data-theme="classic"]` **写在同一组选择器里**。
`<html>` 上没有 `data-theme` 时（内联脚本被 CSP 拦、存储不可用、JS 崩溃）仍然渲染 classic ——
这是兜底路径，不是冗余。`glass` 只写覆盖，不产生第二套样式表。

回归护栏：`scripts/check-tokens.mjs`（令牌逐值比对 + 不变量）、
`scripts/check-contrast.mjs`（对比度验收）。两者都可接 CI。
全项目 `!important` 仅保留在 `element-bridge.css`（EP 特异性需要）与
`theme.css` 的 `prefers-reduced-motion` 块（必须覆盖一切）。

## 设计资产

设计交付位于 `test1/`，已全部接入。资源存放在 `frontend/src/assets/`：

| 目录 | 内容 | 接入方式 |
|---|---|---|
| `images/` | 页面背景、Logo 横版/图标、吉祥物、占位图 ×2 | CSS `url()` / `<img>` / `?raw` 内联 |
| `icons/` | 15 个线性图标 | `SvgIcon.vue` 内联 |
| `illustrations/` | 8 张空状态插画 | `AppIllustration.vue` 内联 |
| `brand/` | 微信 / QQ 官方图标 | `?raw` 内联 |
| `public/` | `favicon.svg`、`share-card.jpg` | 直出，不经过打包 |

**为什么图标和插画必须内联而不是 `<img>`**：设计交付的线性图标用
`stroke="currentColor"`，颜色由父级文字色决定。`<img>` 是独立渲染上下文，
拿不到页面 CSS，`currentColor` 会退化成黑色。所以用 `v-html` 内联
（内容是我们自己的构建期资源，不含用户输入，安全）。

背景图是纯矢量 2560×1440，Vite 把它内联成了 CSS data URI —— 零 HTTP 请求。

### 对交付资产的必要修复

**第一版交付**（`test1/`，已删除）的三张位图存在缺陷：
`mascot-standing.png` / `mascot-head.png` 实为 JPEG（扩展名不符、**无 alpha 通道**），
背景被 AI 画成了真实的「透明棋盘格」像素；`share-card.png` 实为 JPEG 且尺寸是
1950×1024（规格要求 1200×630）。当时用**边界泛洪**（连通性，非全局阈值 ——
猫身的浅色细节与背景色值重叠，全局阈值会把眼睛一起抠掉）临时修复后接入。

**第二版交付**（`网页端设计方案1/`，当前使用）已由设计师修正：

| 文件 | 第二版状态 |
|---|---|
| `ip/mascot-standing.png` | **512×512 真 PNG、8-bit RGBA、含 alpha**。四角 alpha=0，边缘 2.18% 羽化抗锯齿（比泛洪方案更自然） |
| `ip/mascot-head.png` | **512×512 真 PNG、RGBA**。四角 alpha=0，1.69% 羽化 |
| `share/share-card.jpg` | **1200×630 JPEG q85**，28 KB |

**34 个 SVG 与设计令牌的数值与第一版完全一致**，所以这次只需替换 3 个位图，
其余接入代码无需改动。

`mascot-head.png` 除作为小尺寸头像储备外，还用于生成 **`public/apple-touch-icon.png`**
（180×180）—— iOS 的 `apple-touch-icon` **不支持 SVG**，必须用 PNG。
该图标同时被用作应用启动闪屏（`index.html` 的 `#splash`），
在 350 KB(gzip) 主包加载期间显示品牌形象。

### Logo 的一个已知限制

`logo-horizontal.svg` 的字标是 `<text>` 元素（**未转曲**），依赖字体栈。
组件内用 `?raw` 内联而非 `<img>`，这样能继承页面字体、与全站排版一致。
若要彻底消除字体依赖，需在设计软件里把文字转为路径后重新导出。

## 已知的豁免与遗留

以下项目**未达 4.5:1 但属于 WCAG 明确豁免**，不是缺陷：

- `.cal-cell.past`（过去日期，3:1）—— 非活动组件，WCAG 豁免
- 空值占位符 `—`（3:1）—— 纯装饰

> 换成珊瑚红后，装饰性大图标（`.empty-icon` / `.cover-ph`）从 2.79:1 升到 **4.70:1**，
> 已不再需要豁免 —— 珊瑚-深 `#BE514B` 比原先的琥珀-深 `#D4893E` 更暗。

**待办**（本轮未做，需设计产出）：

- `OrderManagement.vue` 订单卡的 `borderLeftColor` 状态条 —— 属「侧边色条」模式，建议改为
  背景浅色调或前置图标
- ~40 处 emoji 仍充当图标（见《设计需求文档》）
- 15 个孤儿页面/组件（有文件无路由）仍在维护旧样式
