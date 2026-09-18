# 主题系统 · 开发指南

> 面向要在本项目里加主题、改令牌、或排查「换了主题但某个地方没跟着变」的开发者。
> 设计层说明见 [UI-GLASS-GUIDE.md](./UI-GLASS-GUIDE.md)，历史取舍见 [DECISIONS.md](./DECISIONS.md)。

---

## 1. 三层 token

```
L1 原语（Primitives）  →  L2 语义（Semantic）  →  L3 组件（Component）
   tokens.primitives.css     tokens.semantic.css      （暂不建立）
   原子值，永不随主题变        语义值，随主题变           仅在有多次复用需求时建
```

### 文件位置与职责

| 文件 | 层 | 职责 | 硬规则 |
|---|---|---|---|
| `src/assets/styles/tokens.primitives.css` | L1 | 色阶 / 透明度 / 阴影配方 / 模糊饱和 / 间距 / 字号 / 字重 / 行高 / 圆角 / 宽度 / 时长 / 缓动 / 层级 / 字体栈 | 只允许 `:root` 变量声明；**禁止任何选择器**；原语名不承载语义（叫 `--c-red-600`，不叫 `--danger-red`）|
| `src/assets/styles/tokens.semantic.css` | L2 | classic 快照 + glass 覆盖 + 降级块 | 只允许变量声明；语义值**必须引用 L1**，不得再写字面值（唯一例外是 glass 块里设计给定的复合配方，如阴影与径向渐变）|
| `src/assets/styles/element-bridge.css` | — | **唯一**允许出现 `--el-*` 与 `.el-*` 覆盖的地方 | 同权重选择器本就能赢（本文件在 EP 之后加载），新增 `!important` 前先问「不加能不能赢」|
| `src/assets/styles/theme.css` | — | 语义组件层（按钮 / 面板 / 徽章 / 容器 / 动效）| 只引用令牌，不定义数值 |
| `src/assets/styles/global.css` | — | 页面级构件与历史兼容类 | 同上 |
| `src/assets/styles/glass.css` | — | glass 专属：背景层 + `.glass` 系列工具类 | 全部规则限定在 `:root[data-theme="glass"]` 下 |
| `src/assets/styles/glass-app.css` | — | glass 专属：后台实色分层 / 表单 / 表格 / 状态页 | 同上 |
| `src/assets/styles/fx.css` | — | 生产护栏：降级与无障碍偏好 | 最后加载，作用是**推翻**前面的值 |
| `src/assets/styles/element-override.scss` | — | Element Plus **编译期** SCSS 变量（色阶 / 尺寸 / 内边距 / 圆角 / 阴影）| 改它会影响**所有**主题，见 §5.2 |

### 加载顺序即优先级

见 `App.vue`：

```
tokens.primitives → tokens.semantic → element-bridge → theme → global → glass → glass-app → fx
```

后加载的同权重选择器获胜。`fx.css` 放最后是因为它的职责就是覆盖前面的值。

### 三层的好处（一句话）

**主题之间的视觉差异全部由 CSS 变量吸收**。组件里没有任何 `if (theme === 'glass')` 分支 —— 组件只认令牌名，令牌由主题决定取值。加第三套主题不需要改任何组件。

---

## 2. 新增一个主题：完整步骤

以加一个 **`dark`（深色）** 主题为例。全程只改 **2 个文件**（外加 3 处硬编码的同步）。

### 步骤 1 · 在 `useTheme.js` 的 `THEME_CONFIG` 里加一项

```js
// src/composables/useTheme.js
export const THEME_CONFIG = [
  { key: 'classic', label: '经典', desc: '暖杏色 · 日系磨砂，原有的界面', hint: '切换到经典界面：暖杏色，中度磨砂' },
  { key: 'glass',   label: '玻璃', desc: '蓝白色 · 冷调通透，玻璃质感', hint: '切换到玻璃界面：蓝白色，冷调玻璃质感' },
  // ↓ 新增
  { key: 'dark',    label: '深色', desc: '暗底 · 低亮度环境下更护眼',  hint: '切换到深色界面：暗底，低亮度环境更护眼' },
]
```

**这一步就让切换器 UI、`?theme=` 参数、localStorage 持久化、`theme:switch` 事件、跨标签页同步全部自动支持** —— 它们都遍历 `THEME_CONFIG`。

但还有 **3 处硬编码的主题键**需要同步（当前实现的已知耦合）：

| 位置 | 内容 | 为什么不能自动 |
|---|---|---|
| `index.html` 的内联脚本 | `/[?&]theme=(classic\|glass)(?:&\|$)/` | 内联脚本不能 import 模块（那样就不是同步执行了）|
| `src/composables/useTheme.js` | 同一条正则 | 与内联脚本必须逐字一致 |
| `src/assets/styles/fx.css` 的对比度块 | `:root[data-theme='glass']` / `:root[data-theme='classic']` | CSS 选择器无法参数化 |

> 有护栏：`check-tokens.mjs` 有一条断言比对 index.html 与 useTheme.js 的两条正则是否**同时存在**。但它不检查**内容是否一致** —— 加主题时请人工核对。

### 步骤 2 · 在 `tokens.semantic.css` 里加覆盖块

**只写需要变的项**。未声明的会从 `:root`（classic 快照）继承。

```css
:root[data-theme="dark"] {
  /* 必须显式声明：否则系统开了暗色模式时，滚动条/表单控件/autofill
     会渲染成深色原生样式，与主题打架。 */
  color-scheme: dark;

  /* ── 品牌色 ──
     深底上不能用深色文字（classic/glass 的 *-ink 都是为白底选的）。 */
  --color-primary:            var(--c-coral-300);
  --color-primary-light:      var(--c-coral-100);
  --color-primary-dark:       var(--c-coral-500);
  --color-primary-ink:        var(--c-coral-100);   /* 深底上的品牌文字 */
  --color-primary-tint:       rgba(232, 99, 92, .16);
  --color-primary-soft:       rgba(232, 99, 92, .24);
  --color-primary-line:       rgba(232, 99, 92, .40);
  --color-primary-gradient:   linear-gradient(135deg, var(--c-coral-500) 0%, var(--c-coral-600) 100%);
  --color-primary-rgb:        236, 127, 121;
  --text-on-primary:          var(--c-coral-950);

  /* ── 文字层级：深色主题的方向与浅色相反，一级最亮、逐级变暗 ── */
  --text-1:                   #F2F0ED;
  --text-2:                   #C9C5C0;
  --text-3:                   #A39E99;
  --text-4:                   #6E6A66;   /* 仅限 disabled 与装饰图形 */
  --text-placeholder:         #A39E99;
  --text-disabled:            #6E6A66;
  --text-inverse:             var(--c-warm-950);

  /* ── 表面：规范名必须覆盖，历史名（--surface-1|2|3）自动跟随 ── */
  --surface-glass:            rgba(38, 36, 34, .86);
  --surface-glass-strong:     rgba(30, 28, 27, .94);
  --surface-glass-quiet:      rgba(44, 42, 40, .76);
  --surface-solid:            #232120;
  --surface-deep:             #141312;

  /* ── 底色 ── */
  --bg-base:                  #1A1918;
  --bg-page:                  #1A1918;
  --bg-card:                  #232120;
  --bg-table-stripe:          #201E1D;
  --bg-input:                 rgba(255, 255, 255, .06);
  --bg-sunken:                rgba(255, 255, 255, .04);

  /* ── 边框：深底上的边框要**提亮**才看得见 ── */
  --border-color:             rgba(255, 255, 255, .14);
  --border-color-solid:       #3A3735;
  --border-subtle:            rgba(255, 255, 255, .08);
  --border-strong:            rgba(255, 255, 255, .24);
  --border-input:             #7A736D;   /* 仍需 >= 3:1 */

  /* ── 状态语义：三元组要**整体翻转** ──
     填充仍是浅色（深底上才显眼），tint 改暗底、ink 改亮色。
     不翻转的话「警告」会变成深黄底 + 深棕字，完全读不了。 */
  --color-success-tint:       rgba(168, 216, 185, .16);
  --color-success-ink:        #9FD3B4;
  --color-warning-tint:       rgba(249, 224, 160, .16);
  --color-warning-ink:        #E8CE8A;
  --color-danger-tint:        rgba(192, 57, 43, .20);
  --color-danger-ink:         #E89A8F;
  --color-info-tint:          rgba(169, 193, 217, .16);
  --color-info-ink:           #A9C1D9;
  --color-neutral-tint:       rgba(255, 255, 255, .08);
  --color-neutral-ink:        #B8B3AE;
  --color-disabled:           #5A5551;
  --color-disabled-bg:        rgba(255, 255, 255, .06);

  /* ── 阴影：深底上阴影几乎不可见，靠边框 + 明度差建层次 ── */
  --shadow-1:                 0 1px 2px rgba(0, 0, 0, .30);
  --shadow-2:                 0 4px 12px rgba(0, 0, 0, .40);
  --shadow-3:                 0 12px 32px rgba(0, 0, 0, .50);
  --shadow-glass:             var(--shadow-2);
  --shadow-primary:           0 4px 14px rgba(232, 99, 92, .30);
  --shadow-glow:              0 0 0 3px rgba(236, 127, 121, .30);

  /* ── 遮罩 / 玻璃边缘 ── */
  --scrim:                    rgba(0, 0, 0, .60);
  --divider-on-deep:          rgba(255, 255, 255, .14);
  --glass-stroke:             rgba(255, 255, 255, .14);
  --glass-hairline:           var(--glass-stroke);
  --glass-edge-top:           rgba(255, 255, 255, .22);
  --glass-highlight:          inset 0 1px 0 rgba(255, 255, 255, .10);

  /* ── 表格 ── */
  --table-head-bg:            #262422;
  --table-hover-bg:           #2E2B29;
  --table-zebra-bg:           #201E1D;
  --table-row-border:         rgba(255, 255, 255, .07);
  --admin-bg:                 #1A1918;

  /* ── 焦点 / 骨架屏 ── */
  --focus-glow:               0 0 0 4px rgba(236, 127, 121, .30);
  --skeleton-bg:              #2A2826;
}
```

**不需要覆盖的**：间距 / 字号 / 圆角 / 宽度 / 时长 / 缓动 / 层级 / 字体栈 —— 与主题无关。

### 步骤 3 · 如需玻璃观感，扩展工具类的主题名单

`.glass` 系列工具类只在 `:root[data-theme="glass"]` 下生效。深色主题若要玻璃观感，需把 `glass.css` 里的选择器并列展开：

```css
:root[data-theme='glass'] body::before,
:root[data-theme='dark']  body::before { /* ... */ }
```

> 这是当前架构里**最不优雅的一处**：工具类的主题名单硬编码在选择器里。更好的做法是把「哪些主题用玻璃观感」也做成数据，但会牵动 `glass.css` / `glass-app.css` 的全部规则，本轮没做。

### 步骤 4 · 验证

```bash
cd frontend
npx vite build --outDir /tmp/mz-check --emptyOutDir

# (1) 令牌回归：classic 必须零差异
node scripts/check-tokens.mjs \
  /tmp/mz-dist-before/assets/index-COEr9CQ8.css \
  $(ls /tmp/mz-check/assets/index-*.css)

# (2) 对比度（新主题的用例需手动加进 check-contrast.mjs 的 CASES / DEGRADE 数组）
node scripts/check-contrast.mjs

# (3) 视觉基线
DIST_DIR=/tmp/mz-check npx playwright test --project=chromium visual.spec --update-snapshots

# (4) 功能 + 跨引擎
DIST_DIR=/tmp/mz-check npx playwright test --project=chromium switcher fx theme-defaults
for e in chromium firefox webkit; do
  DIST_DIR=/tmp/mz-check npx playwright test --browser=$e smoke
done
```

**加主题时最容易漏的两件事**：
1. `color-scheme` —— 不写的话原生控件跟着系统走，与主题打架
2. **状态语义三元组的翻转** —— 只改 `--color-success` 而不改 `-tint` / `-ink`，会得到「深底 + 深字」这种读不了的组合

---

## 3. 硬性规则清单

### 3.1 哪些地方**不能**写死颜色

| 位置 | 允许吗 | 说明 |
|---|---|---|
| `tokens.primitives.css` | 只能在这里 | 这里是**值的唯一来源** |
| `tokens.semantic.css` | 仅限主题覆盖块 | 语义层必须引用 L1；唯一例外是 glass/dark 块里设计给定的复合配方 |
| `theme.css` / `global.css` | 不允许 | 只引用令牌 |
| `glass.css` / `glass-app.css` / `fx.css` 的**规则**里 | 不允许 | 同上 |
| 同上三份文件的**令牌定义块**里 | 允许 | `:root[data-theme=...]` / `:root[data-fx=...]` / `@media (prefers-contrast)` —— 那是**定义**，不是使用 |
| 组件的 `<style scoped>` | 不允许 | 一律 `var(--token)` |
| 组件的 `:style="{ color: ... }"` | 不允许 | 局部变量用 `--pv-*` 这类组件前缀并在注释里说明 |
| SVG **属性选择器**里的 `#E8635C` | 允许 | `.illustration [stroke='#E8635C']` 是**匹配**资产里的属性值，不是施加颜色 |
| `mask-image` 里的 `#000` | 允许 | 遮罩值：不透明=保留、透明=挖掉，与主题色无关 |
| `<meta name="theme-color">` | 注意 | 目前是 `#E8635C`（classic 品牌色），切到 glass **不会**跟着变 —— 已知限制 |

**自查命令**：

```bash
cd frontend
grep -nE "^[[:space:]]+[a-z-]+:.*#[0-9a-fA-F]{3,8}|^[[:space:]]+[a-z-]+:.*rgba?\([0-9]" \
  src/assets/styles/*.css | grep -vE "stroke='|fill='|mask-image"
```

### 3.2 哪些组件**必须**用实色表面

| 组件 | 必须实色 | 为什么 |
|---|---|---|
| 表单输入框 / 文本域 / 下拉 / 日期选择器 | 是 | 玻璃底上的半透明输入框会让文字与**光标**随背光变化，读写都吃力 |
| 照片容器与其上的信息条 | 是 | 玻璃覆盖层会压暗照片、加一层灰雾，直接毁画质 |
| 照片上压的文字标签 | 是（不透明底）| 见下方代码示例 |
| 数据表格（行 / 单元格 / 表头） | 是 | 长时间盯屏；半透明会让每行底色随上下文变化，对比度无法预算 |
| 后台主体（`.dashboard` 子树） | 是 | 数据密集界面不用 `backdrop-filter`，靠实色分层 + 细边框建层次 |
| Footer | 是 | 最深一档表面，与玻璃互斥（深色面叠半透明磨砂会又脏又糊）|
| 灯箱 / 模态浮层 | 遮罩可半透明，**内容面板**要实色 | 浮层上的文字必须稳定可读 |
| 空状态 / 卡片列表项 | 半透明可接受，**不要加 `backdrop-filter`** | 一屏 20 张卡 = 20 次离屏模糊 |

**压在照片上的文字**：一律用不透明底，不要靠 `backdrop-filter`。

```css
/* 正确：不透明底，对比度与照片内容无关 */
.cover-tag { background: var(--color-primary); color: var(--text-on-primary); }

/* 错误：半透明 + 模糊，同一段文字在不同照片上对比度会剧烈波动 */
.cover-tag { background: rgba(255,255,255,.3); backdrop-filter: blur(8px); }
```

### 3.3 `backdrop-filter` 的使用条件

**只在「内容会从它下面滚过去」的元素上使用**。同时满足三条才用：

1. 小面积（不是整页容器、不是长列表）
2. 数量有限（同一视口 ≤ 5 个）
3. 内容会从它下面滚过去（吸顶导航、吸底 tab、浮层）

> 反直觉但重要：**平滑渐变背景上，模糊几乎看不出来**。此时 `backdrop-filter` 是纯开销 —— 每次都要建一个合成层，而视觉收益接近零。实测：首页 5 个模糊层全部移除后，TBT 从 938ms 变成 938ms（见 [DECISIONS.md](./DECISIONS.md)）。

---

## 4. 玻璃配方工具类

`glass.css` 定义三档，全部限定在 `:root[data-theme="glass"]` 下：

```html
<div class="glass">...</div>         <!-- 主力档 -->
<div class="glass-strong">...</div>  <!-- 高填充 -->
<div class="glass-quiet">...</div>   <!-- 低填充 -->
```

### 配方构成（四层，缺一玻璃就「平」掉）

```css
border: 1px solid var(--glass-stroke);                 /* 1. 冷色描边勾勒轮廓 */
border-top-color: var(--glass-edge-top);               /* 2. 更亮的上沿 = 边缘受光 */
box-shadow: var(--shadow-2), var(--glass-highlight);   /* 3+4. 外投影 + 内上沿高光 */
background: var(--surface-glass);
backdrop-filter: var(--glass-blur);
```

### 三种强度的适用场景

| 类 | 填充档（glass 主题下）| 适用场景 | **不要**用在哪 |
|---|---|---|---|
| `.glass` | `rgba(255,255,255,.62)` | **独立浮起的面板**：吸顶导航条、悬浮工具条、单个主面板。它是「一个」东西，不是「一堆」 | 成组出现的卡片（一屏多个就超预算）|
| `.glass-strong` | `rgba(255,255,255,.78)` | **要承载输入控件或密集文字**的面板：搜索条、吸顶筛选栏。底色越实，文字与光标越稳 | 纯装饰性容器（用 `.glass` 就够）|
| `.glass-quiet` | `rgba(255,255,255,.42)` | **成组出现、需要更「轻」的卡片**：三张能力卡这类同行排列的小卡片 | **此档上禁止放 `--text-3` 及更浅的字** |

### 使用约定

- **不要在组件里重写玻璃配方**。需要不同观感时先问：是要换档位，还是真的需要新配方？后者应该加进 `glass.css` 而不是复制到组件里。
- 玻璃容器的圆角 / 间距 / 内容布局由组件自己定，工具类只管「表面」。
- **hover / 过渡只动 `transform` 与 `opacity`**，不要动画 `box-shadow` 或 `backdrop-filter`。需要「阴影渐显」时把更深的阴影放在 `::after` 上，只过渡它的 `opacity`（见 `GlassHome.vue` 的 `.gh-feature`）。

### 焦点环

玻璃底上的焦点环必须是**实色**：

```css
.xxx:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
```

`prefers-contrast: more` 时由 `fx.css` 自动加粗到 3px。

> 写了 `outline: none` 就必须补一个替代焦点环。本项目曾有 2 处漏掉（Hero 搜索框输入、品牌链接），由「真实 Tab 路径」的焦点可见性测试抓出。

---

## 5. 三个容易踩的坑

### 5.1 组件 scoped 样式与主 CSS 的加载顺序

组件 scoped 样式编译成 `.foo[data-v-xxx]`（特异性 0,2,0），且位于**路由 chunk 的 CSS** 里，**加载顺序晚于主 CSS 包**。同特异性时主 CSS 会输。

| 要覆盖的类 | 写在哪 |
|---|---|
| `theme.css` / `global.css` / `element-bridge.css` 里的全局类 | 可以写在 `glass-app.css` / `fx.css`（加载更晚，同特异性即胜出）|
| **组件 scoped 的私有类** | **写进那个组件自己的 `<style scoped>`**，加 `:root[data-theme="glass"]` 前缀 —— Vue 会把属性选择器加到最后一段，特异性自然变成 (0,3,0)，稳赢 |

### 5.2 Element Plus 的编译期定制无法运行时切换

`element-override.scss` 里的 `$colors` / `$common-component-size` / `$button-border-radius` 等是**构建期烧死**的。

- **颜色**可以运行时改：`element-bridge.css` 把 `--el-*` 接到了语义令牌上
- **尺寸 / 内边距 / 按钮圆角形态**改不动。`--radius-btn` 是唯一例外 —— 我们在 `element-bridge.css` 显式桥接了 `.el-button { border-radius: var(--radius-btn) }`（classic 下该链路的取值恰好等于编译期字面量 `9999px`，所以不影响 classic）

**推论**：主题**不能**改变 Element Plus 组件的尺寸与内边距。要改就得改编译期，那会同时影响所有主题。

### 5.3 `-webkit-backdrop-filter` 里的字面量

```css
.glass {
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  backdrop-filter: var(--glass-blur);
}
```

两者当前取值相同，任何引擎结果一致。之所以能安全地写字面量，是因为这些类**只在 glass 生效**，不存在「classic 下前缀属性与标准属性不一致」的窗口。

`check-tokens.mjs` 有一条断言守住两者一致 —— **改玻璃模糊强度时必须同时改两处**。

---

## 6. 相关文件一览

```
frontend/
├── index.html                        主题引导 + 降级判定（内联脚本，首帧前同步执行）
├── src/
│   ├── App.vue                       7 份 CSS 的导入顺序（即优先级）
│   ├── composables/
│   │   ├── useTheme.js               ★ 全站唯一的主题读写入口 + THEME_CONFIG
│   │   └── useFx.js                  降级状态的运行时维护
│   ├── components/common/
│   │   └── ThemeSwitcher.vue         切换器（导航条 / 移动端浮层共用）
│   └── assets/styles/                见 §1 的表格
└── scripts/
    ├── check-tokens.mjs              令牌逐值比对 + 不变量（25 条）
    ├── check-contrast.mjs            对比度验收
    └── visual/                       Playwright：视觉基线 / 功能 / 冒烟 / 滚动性能
```
