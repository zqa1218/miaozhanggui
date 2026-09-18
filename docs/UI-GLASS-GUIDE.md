# 蓝白玻璃 · 设计指南

> 面向在 glass 主题下**新增界面**的人。令牌机制见 [THEMING.md](./THEMING.md)，取舍依据见 [DECISIONS.md](./DECISIONS.md)。
> 一句话概括这套视觉：**浅蓝白底 + 冷调玻璃面板 + 蓝图网格骨架**。不是深色科技风，不是霓虹赛博，也不是毛玻璃拟物。

---

## 1. 六条设计原则

### 1.1 浅底要高填充

底色是 `#F7FAFF`（很浅的蓝白），背景上还有彩色光斑。玻璃面板压在浅底上时，**必须靠较高的白色填充把自身「提」出来**：

| 档位 | 填充 | 为什么是这个值 |
|---|---|---|
| `.glass` | `rgba(255,255,255,.62)` | 浅底本身已经够亮，再低面板就与背景糊在一起，边界只能靠描边撑 —— 看起来像「贴纸」而不是「浮起的面板」 |
| `.glass-strong` | `rgba(255,255,255,.78)` | 承载输入控件 / 密集文字，宁可少透一点也要保可读 |
| `.glass-quiet` | `rgba(255,255,255,.42)` | 只在**成组、面积小**的卡片上用 |

> 反面直觉：很多人以为「玻璃感 = 越透越好」。浅底上恰恰相反 —— 透到 30% 以下时背景光斑直接穿过面板，玻璃不再是「一层材质」，而是「一块脏了的背景」。

### 1.2 亮顶边

每块玻璃必须有**上沿高光**，这是「边缘受光」的物理线索：

```css
border-top-color: var(--glass-edge-top);              /* rgba(255,255,255,.90) */
box-shadow: var(--shadow-2), var(--glass-highlight);  /* inset 0 1px 0 rgba(255,255,255,.55) */
```

glass 的 `--glass-edge-top` 取 `.90`（classic 是 `.55`）—— 因为 glass 的面板更透明，需要更明确的上沿才能「立」起来。

**去掉这行会怎样**：面板变成一块平的半透明矩形。在浅底上尤其明显，因为描边本身也很淡。

### 1.3 网格骨架

背景有一层 32px 的蓝图网格（`rgba(37,99,235,.07)`），四周用径向遮罩渐隐：

```css
background-image:
  linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
  linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
background-size: var(--grid-size) var(--grid-size);
mask-image: radial-gradient(ellipse 78% 68% at 50% 38%, #000 42%, transparent 100%);
```

它的作用是给整页一个**技术感骨架**，替代了 classic 的位图背景（`page-bg.svg`）。网格必须**渐隐收边** —— 满屏直角网格会显得像 UI 漏了样式。

### 1.4 玻璃数量上限：每屏 ≤ 5 个

**计数单位是「同一视口内可见的玻璃容器」**，首页当前是 5/5：

| # | 位置 | 档位 |
|---|---|---|
| 1 | 顶部导航条 | `.glass` |
| 2 | Hero 搜索条 | `.glass-strong` |
| 3–5 | 三张能力卡 | `.glass-quiet` |

**为什么是 5**：
- 每个 `backdrop-filter` 元素都要建一个合成层 + 一次离屏模糊。5 个是滚动时仍能保持 60fps 的实测上限。
- 超过 5 个之后，视觉上也不再是「几块浮起的玻璃」，而是「一堆半透明方块」—— 层级感反而丢失。

**新页面要加玻璃时**：先数现有的，超了就换实色表面。`GlassHome.vue` 顶部有一段注释记录了当前预算，改首页请同步更新它。

### 1.5 照片不做模糊底

**照片容器上永远不要叠 `backdrop-filter`。** 两个原因：

1. **画质**：模糊层会给照片加一层灰雾并压暗，这是直接毁掉摄影作品的行为 —— 而本平台的核心资产就是照片。
2. **对比度不可控**：照片内容不可预知，压在它上面的半透明层意味着文字的对比度**随照片变化**，无法预算也无法验收。

```css
/* 正确：照片干净，信息条是不透明实色 */
.photo-card__img { display: block; width: 100%; aspect-ratio: 3 / 4; object-fit: cover; }
.photo-card__bar { background: var(--surface-solid); color: var(--text-1); }

/* 错误：磨砂盖在照片上 */
.photo-card__img { filter: blur(2px); }              /* 甚至更糟 */
.photo-card__overlay { backdrop-filter: blur(12px); }
```

压在图上的标签用**不透明底**：

```css
.cover-tag { background: var(--color-primary); color: var(--text-on-primary); }
```

### 1.6 文字不压漂移渐变

**光斑是静态的**（`body::before` 上的一次性 `blur(80px)`），并且**有意不做漂移动画**——尽管设计要求里把它列为可选项。

理由：Hero 标题直接压在光斑上。如果光斑缓慢漂移，标题底色的亮度就会随时间变化，对比度无法给出一个固定值 —— 这与「正文对比度 ≥ 4.5:1 是验收项」直接冲突。静态光斑已经足够好看，还省掉持续的合成开销。

**推论**：任何新增的、压在文字下面的装饰层，都必须**静态**。要动效就动别的东西（`transform` / `opacity`）。

---

## 2. 什么情况下**不要**用玻璃 —— 检查清单

逐条对照，命中任意一条就换实色表面。

- [ ] **它是输入控件吗？**（输入框 / 文本域 / 下拉 / 日期选择器）→ 用 `--bg-input`（`rgba(255,255,255,.78)`）+ `--border-input`。半透明输入框会让文字与光标随背景变化。
- [ ] **它一屏会出现 5 个以上吗？** → 用实色。计数按视口内可见的算。
- [ ] **它的内容会长时间被盯着看吗？**（数据表格 / 金额 / 订单列表）→ 用 `--surface-solid`。半透明表面让每行底色随上下文变化，对比度无法预算。
- [ ] **它在商家后台里吗？** → 一律实色。后台是收钱工具，不用 `backdrop-filter`（见 [DECISIONS.md](./DECISIONS.md)）。
- [ ] **它是照片容器或压在照片上的东西吗？** → 不透明实色。
- [ ] **背景在它后面是静止不变的吗？**（比如页面 Footer 区域、纯色区块）→ 模糊看不出来，是纯开销，用实色。
- [ ] **它需要承载 `--text-3` 及更浅的文字吗？** → `.glass-quiet` 上不允许；改 `.glass-strong` 或实色。
- [ ] **它是大面积容器吗？**（整页 wrapper、长列表）→ 不透明实色。大面积离屏模糊是滚动掉帧的主因。

---

## 3. 常见错误与反面教材

### 3.1 在组件里重写玻璃配方

```css
/* 错误：配方被复制进组件，四层只抄了两层 */
.my-card {
  background: rgba(255, 255, 255, .6);
  backdrop-filter: blur(20px);
}

/* 正确：用工具类 */
```
```html
<div class="glass-quiet my-card">...</div>
```

复制配方的问题不是「重复」，而是**它会在令牌调整后过期且无人提醒**。玻璃配方有 4 个组成部分，抄漏一个（通常是亮顶边）就变成平的一块。

### 3.2 用玻璃做全屏容器

```css
/* 错误：整页 wrapper 上挂 backdrop-filter —— 滚动时每帧对整个视口做离屏模糊 */
.page-wrapper { backdrop-filter: blur(18px); }

/* 正确：装饰层用 fixed 定位 + 一次性模糊，内容层不模糊 */
body::before { position: fixed; filter: blur(80px); }
```

**关键区别**：`filter` 用在 `position: fixed` 的装饰层上 → 只光栅化一次，滚动不重绘。`backdrop-filter` 用在大面积滚动容器上 → 每帧重算。

### 3.3 用 `!important` 覆盖玻璃

```css
/* 错误 */
.my-panel { background: #fff !important; }

/* 正确：提高特异性，或用实色表面令牌 */
:root[data-theme='glass'] .my-panel { background: var(--surface-solid); }
```

`!important` 会连带干掉降级块（`@supports not (backdrop-filter)` 和 `prefers-contrast: more`）——那两块也是靠特异性/顺序赢的。

### 3.4 过渡 `backdrop-filter` 或 `box-shadow`

```css
/* 错误：每帧重新计算模糊半径，必然掉帧 */
.card { transition: backdrop-filter .3s, box-shadow .3s; }

/* 正确：阴影渐显放在 ::after 上，只过渡 opacity；位移用 transform */
.card { transition: transform var(--dur-200) var(--ease-expo-out); }
.card::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit;
  box-shadow: var(--shadow-3); opacity: 0; pointer-events: none;
  transition: opacity var(--dur-200) var(--ease-expo-out);
}
.card:hover::after { opacity: 1; }
.card:hover { transform: translateY(-4px); }
```

### 3.5 `-webkit-backdrop-filter` 里写变量

```css
/* 错误：某些引擎不解析前缀属性里的 var() —— 整条声明被丢弃，
   表现为「Safari 上完全没有模糊」，而标准属性正常，所以只在 Safari 上复现 */
.glass { -webkit-backdrop-filter: blur(var(--glass-blur-length)); }

/* 正确：前缀属性写字面量，标准属性用变量 */
.glass {
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  backdrop-filter: var(--glass-blur);
}
```

> 只在 glass 主题生效的类可以放心写字面量（classic 下这些类不存在，没有不一致窗口）。`check-tokens.mjs` 有一条断言守住两者取值一致。

### 3.6 玻璃上放浅色文字

```css
/* 错误：--text-3 在 .glass-quiet 上约 3.0:1，正文不达标 */
.glass-quiet .meta { color: var(--text-3); }

/* 正确：换更深一档，或换更实的表面 */
.glass-quiet .meta { color: var(--text-2); }
```

`check-contrast.mjs` 会对玻璃表面按**最差背光**（光斑最浓处）计算对比度 —— 你以为的 4.6:1 可能是按纯白底算的，实际背景是蓝紫色光斑。

### 3.7 装饰层不加 `aria-hidden`

```html
<!-- 错误：光斑与网格是纯装饰，读屏会尝试朗读 -->
<div class="mesh-layer"></div>

<!-- 正确 -->
<div class="mesh-layer" aria-hidden="true"></div>
```

本项目用 `body::before` / `body::after` 实现，**伪元素不在无障碍树里**，天然满足。但若改成真实 DOM（例如需要在上面挂 JS），必须补 `aria-hidden="true"`。

### 3.8 焦点环用玻璃色

```css
/* 错误：焦点环本身半透明，压在玻璃上没有足够对比 */
.xxx:focus-visible { outline: 2px solid rgba(37, 99, 235, .3); }

/* 正确：实色，且 > 3:1 */
.xxx:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
```

`prefers-contrast: more` 时由 `fx.css` 自动加粗到 3px。

---

## 4. 移动端（375px）

glass 主题在移动端做了三处**有意**的降级，都是取舍不是遗漏：

| 项目 | 桌面 | 移动端 | 理由 |
|---|---|---|---|
| 光斑模糊半径 | `blur(80px)` | `blur(40px)` | 80px 是首帧最大的一笔光栅化开销；小屏上光斑可视面积本来就小，肉眼几乎无差 |
| 玻璃容器数量 | 5 | ≤ 3 | 小屏视口内挤不下 5 块玻璃，且低端机合成层预算更紧 |
| 导航形态 | 横向导航条 | 抽屉（同一 `ThemeSwitcher` 组件的 `sheet` 变体）| — |

**移动端不要做的**：
- 不要为了「更像玻璃」在移动端提高模糊半径
- 不要在移动端用 `backdrop-filter` 做吸底 tab（滚动时每帧重算，低端 Android 直接掉帧）

---

## 5. 新增 glass 界面的自查流程

```
1. 数玻璃预算      → 同屏超过 5 个？→ 换实色
2. 过 §2 检查清单  → 命中任意一条？→ 换实色
3. 选档位          → 承载输入/密集文字用 .glass-strong，独立浮起用 .glass，成组小卡用 .glass-quiet
4. 检查对比度      → node scripts/check-contrast.mjs
5. 检查硬编码色    → grep 自查命令见 THEMING.md §3.1
6. 跑视觉基线      → DIST_DIR=<产物> npx playwright test --project=chromium visual.spec
7. 跑跨引擎冒烟    → for e in chromium firefox webkit; do npx playwright test --browser=$e smoke; done
```
