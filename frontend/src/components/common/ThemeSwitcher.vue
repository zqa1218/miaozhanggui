<script setup>
/**
 * 界面风格切换器
 * ---------------------------------------------------------------
 * 首页导航右侧与移动端浮层里用的是**同一个组件**（靠 variant 区分呈现）。
 *
 * ── ARIA 结构（menu 模式，而不是 listbox/radiogroup）──
 *   <a role 保持链接>  aria-haspopup="menu" aria-expanded aria-controls
 *     ↓ 点击 / ↓ 键
 *   <div role="menu" aria-labelledby=触发器>
 *     <div role="menuitemradio" aria-checked="true|false"> × 主题数
 *
 *   选 menu 而不是 radiogroup，是因为键位模型正好对上需求：
 *   menu 的约定就是「方向键在项间移动、Enter/Space 激活、Esc 关闭并把焦点
 *   还给触发器」，而 radiogroup 的约定是「方向键即选中」。
 *   这里方向键只移动、Enter 才切换，用 menu 语义才不会和读屏预期打架。
 *
 * ── 渐进增强 ──
 *   触发器渲染成**真实的 <a href="?theme=xxx">**，而不是 <button>。
 *   正常情况下 @click.prevent 会拦掉它、走组件逻辑；但如果 JS 挂了、
 *   或者这个 chunk 加载失败导致事件没绑上，链接本身仍然可用 ——
 *   而 ?theme= 是 index.html 内联脚本就支持的能力，点击后确实会切主题。
 *   这不是理论问题：它是「切换器坏掉时页面依然可用」的兜底路径。
 *
 * ── 水合 / 首屏 ──
 *   本项目是纯 SPA、没有 SSR，因此不存在 hydration mismatch。
 *   但仍按同一原则实现：**选中态只存在于面板里，而面板只在用户交互后
 *   才挂载**。首屏渲染的触发器不依赖任何主题状态（标签恒为「界面风格」），
 *   所以即使主题在挂载后才确定，也不会有任何内容需要回填或闪一下。
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useTheme, readThemeTokens, resetTheme, THEME_CONFIG } from '@/composables/useTheme'

const props = defineProps({
  /** nav = 首页导航条右侧；sheet = 移动端浮层内（竖排、带「恢复默认」） */
  variant: { type: String, default: 'nav' },
})

const { theme, setTheme, forced } = useTheme()

const open = ref(false)
const triggerEl = ref(null)
const panelEl = ref(null)
const activeIndex = ref(0)

const currentOption = computed(
  () => THEME_CONFIG.find((t) => t.key === theme.value) || THEME_CONFIG[0]
)

/* 禁用态的下一项：渐进增强用的链接目标 */
const nextKey = computed(() => {
  const i = THEME_CONFIG.findIndex((t) => t.key === theme.value)
  return THEME_CONFIG[(i + 1) % THEME_CONFIG.length].key
})
const fallbackHref = computed(() => {
  try {
    const u = new URL(window.location.href)
    u.searchParams.set('theme', nextKey.value)
    return u.pathname + u.search + u.hash
  } catch (e) {
    return `?theme=${nextKey.value}`
  }
})

/* ── 迷你预览 ──
   色值从活的 CSS 里读（见 readThemeTokens 注释），不抄在配置里。
   打开面板时才读一次并缓存：读它会把 data-theme 临时切走再切回，
   虽然同一帧内不会绘制，但没必要在每次渲染时都做。 */
const previews = ref({})
function loadPreviews() {
  const out = {}
  for (const t of THEME_CONFIG) out[t.key] = readThemeTokens(t.key)
  previews.value = out
}
function previewStyle(key) {
  const t = previews.value[key]
  if (!t || !t.bg) return {}
  return {
    '--pv-bg': t.bg,
    '--pv-surface': t.surface,
    '--pv-border': t.border,
    '--pv-brand': t.brand,
  }
}

/* ── 开关 ── */
async function openPanel(index) {
  loadPreviews()
  open.value = true
  const checked = THEME_CONFIG.findIndex((t) => t.key === theme.value)
  activeIndex.value = typeof index === 'number' ? index : Math.max(0, checked)
  await nextTick()
  focusOption(activeIndex.value)
}

function closePanel(refocus = true) {
  open.value = false
  if (refocus) triggerEl.value?.focus()
}

function focusOption(i) {
  const items = panelEl.value?.querySelectorAll('[role="menuitemradio"]')
  if (!items || !items.length) return
  const n = items.length
  activeIndex.value = (i + n) % n // 环绕
  items[activeIndex.value].focus()
}

function onTriggerClick(e) {
  e.preventDefault()
  if (open.value) closePanel()
  else openPanel()
}

function onTriggerKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    openPanel(0)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    openPanel(THEME_CONFIG.length - 1)
  }
}

function onPanelKeydown(e) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      focusOption(activeIndex.value + 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      focusOption(activeIndex.value - 1)
      break
    case 'Home':
      e.preventDefault()
      focusOption(0)
      break
    case 'End':
      e.preventDefault()
      focusOption(THEME_CONFIG.length - 1)
      break
    case 'Escape':
      e.preventDefault()
      closePanel()
      break
    case 'Tab':
      // menu 的约定：Tab 离开即关闭，但**不**抢回焦点 ——
      // 用户是想去下一个控件，硬把焦点拉回触发器是很讨厌的行为
      closePanel(false)
      break
    default:
      break
  }
}

async function onReset() {
  resetTheme()
  closePanel(false)
  await restoreFocus()
}

async function select(key) {
  setTheme(key)
  closePanel(false)

  /* 焦点归还。
     在 `/` 上切换主题会把整个首页组件换掉（glass 与 classic 是两套组件，
     见 WelcomeView 的分流），本实例随之销毁、触发器被重建。此时如果只是
     把焦点留在原地，它会掉到 <body> 上 —— 键盘用户按一次回车就被丢回
     文档开头，等于切换之后失去了位置。

     所以：本实例还在就聚焦自己；已经被换掉了，就聚焦重建后的那一个。 */
  await restoreFocus()
}

/** 元素是否真的可见（display:none 的不可聚焦，聚焦了也没用）。 */
function isVisible(el) {
  return !!el && el.getClientRects().length > 0
}

/**
 * 把焦点交回触发器。
 *
 * `/` 上同时存在两个触发器实例：WelcomeView 的浮动入口与 GlassHome 导航条里
 * 的那一个，按主题显示其中一个（另一个 display:none）。所以这里不能简单地
 * 「聚焦自己」或「聚焦第一个」—— 必须聚焦**可见的**那一个。
 */
async function restoreFocus() {
  await nextTick()
  if (tryFocusTrigger()) return

  /* 起点还没出现 —— 因为 `/` 上的新首页是**异步 chunk**（见 WelcomeView 里
     defineAsyncComponent 的说明），nextTick 时它往往还没挂载完成。

     这里逐帧等它出现，而不是用 setInterval 轮询：rAF 与渲染同频，
     最多 40 帧（约 0.6s）就放弃，不会留下一个长期跑着的定时器。
     放弃也不报错 —— 焦点留在 body 上是可接受的退化，
     总好过为了焦点把一次主题切换变成可能失败的操作。 */
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => requestAnimationFrame(r))
    if (tryFocusTrigger()) return
  }
}

/** 尝试把焦点交给「可见的那个触发器」；成功返回 true。 */
function tryFocusTrigger() {
  if (isVisible(triggerEl.value)) {
    triggerEl.value.focus()
    return true
  }
  const visible = Array.from(document.querySelectorAll('.tsw-trigger')).find(isVisible)
  if (visible) {
    visible.focus()
    return true
  }
  return false
}

/* ── 点击外部关闭 ── */
function onDocPointerDown(e) {
  if (!open.value) return
  if (triggerEl.value?.contains(e.target)) return
  if (panelEl.value?.contains(e.target)) return
  closePanel(false)
}

onMounted(() => document.addEventListener('pointerdown', onDocPointerDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerDown, true))
</script>

<template>
  <div class="tsw" :class="`tsw--${variant}`">
    <!-- 触发器：默认是链接（无 JS 也能用），有 JS 时拦截为面板开关 -->
    <a
      ref="triggerEl"
      class="tsw-trigger"
      :href="fallbackHref"
      :aria-haspopup="'menu'"
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="tsw-menu"
      @click="onTriggerClick"
      @keydown="onTriggerKeydown"
    >
      <!-- 图标随主题变化：经典是暖杏圆点，玻璃是冷蓝方块，一眼能对上 -->
      <span class="tsw-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
          <rect x="1.5" y="1.5" width="13" height="13" rx="3.5" stroke="currentColor" stroke-width="1.4" />
          <path d="M1.5 6.5h13" stroke="currentColor" stroke-width="1.4" />
          <circle cx="5" cy="10.5" r="1.4" fill="currentColor" />
        </svg>
      </span>
      <span class="tsw-label">界面风格</span>
      <span class="tsw-current">{{ currentOption.label }}</span>
      <span class="tsw-caret" aria-hidden="true">
        <svg viewBox="0 0 10 6" width="10" height="6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </a>

    <div
      v-if="open"
      id="tsw-menu"
      ref="panelEl"
      class="tsw-panel"
      role="menu"
      aria-labelledby="tsw-menu-label"
      @keydown="onPanelKeydown"
    >
      <p id="tsw-menu-label" class="tsw-panel__title">界面风格</p>

      <div
        v-for="opt in THEME_CONFIG"
        :key="opt.key"
        class="tsw-option"
        :class="{ 'is-active': opt.key === theme }"
        role="menuitemradio"
        :aria-checked="opt.key === theme ? 'true' : 'false'"
        :aria-label="opt.hint"
        tabindex="-1"
        @click="select(opt.key)"
        @keydown.enter.prevent="select(opt.key)"
        @keydown.space.prevent="select(opt.key)"
      >
        <!-- 迷你预览：色值来自该主题的真实令牌，不是截图 -->
        <span class="tsw-preview" :style="previewStyle(opt.key)" aria-hidden="true">
          <span class="tsw-preview__card"></span>
          <span class="tsw-preview__dot"></span>
        </span>

        <span class="tsw-option__text">
          <span class="tsw-option__label">{{ opt.label }}</span>
          <span class="tsw-option__desc">{{ opt.desc }}</span>
        </span>

        <span class="tsw-check" aria-hidden="true">
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none">
            <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </div>

      <!-- 恢复默认只在浮层里给：导航条上的空间要留给主操作，而且这是低频动作 -->
      <button v-if="variant === 'sheet'" type="button" class="tsw-reset" @click="onReset">
        恢复默认
      </button>

      <p v-if="forced" class="tsw-forced">
        本次访问的主题由链接参数固定，切换不会保存
      </p>
    </div>
  </div>
</template>

<style scoped>
/* 全部用语义令牌 —— 组件本身不区分主题，颜色由当前主题的令牌决定。
   这里没有任何 `if (theme === 'glass')` 分支：主题差异由 CSS 变量吸收。 */
.tsw { position: relative; }

.tsw-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--glass-stroke);
  border-radius: var(--radius-pill);
  color: var(--text-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--duration-1) var(--ease-out),
              border-color var(--duration-1) var(--ease-out);
}
.tsw-trigger:hover { color: var(--text-1); border-color: var(--brand); }
.tsw-trigger:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

.tsw-icon { display: inline-flex; color: var(--brand); }
.tsw-caret { display: inline-flex; color: var(--text-3); }
.tsw-current {
  color: var(--text-1);
  padding-left: 6px;
  margin-left: 2px;
  border-left: 1px solid var(--border-subtle);
}

/* ── 面板 ── */
.tsw-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: calc(var(--z-sticky) + 1);
  width: 300px;
  padding: var(--space-2);
  background: var(--surface-solid);
  border: 1px solid var(--border-color-solid);
  border-radius: var(--radius-modal);
  box-shadow: var(--shadow-3);
}
.tsw-panel__title {
  margin: 2px 0 var(--space-2);
  padding: 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .06em;
  color: var(--text-3);
}

.tsw-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color var(--duration-1) var(--ease-out);
}
.tsw-option:hover { background: var(--color-primary-tint); }
.tsw-option:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: -2px;
}
.tsw-option.is-active { background: var(--color-primary-tint); }

/* 迷你预览：一张按该主题令牌渲染的小卡片。
   48×34 里放得下三件事：页面底、卡片面、品牌点 —— 已经足够认出是哪套。 */
.tsw-preview {
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 34px;
  border-radius: var(--radius-sm);
  background: var(--pv-bg, var(--bg-sunken));
  border: 1px solid var(--pv-border, var(--border-color));
  overflow: hidden;
}
.tsw-preview__card {
  position: absolute;
  left: 5px;
  top: 6px;
  right: 5px;
  bottom: 6px;
  border-radius: 4px;
  background: var(--pv-surface, #fff);
  border: 1px solid var(--pv-border, transparent);
}
.tsw-preview__dot {
  position: absolute;
  left: 10px;
  top: 12px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--pv-brand, #999);
}

.tsw-option__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.tsw-option__label { font-size: 14px; font-weight: 700; color: var(--text-1); }
.tsw-option__desc { font-size: 12px; color: var(--text-3); }

/* 勾选：形状 + 颜色双重编码，不只靠颜色 */
.tsw-check {
  flex-shrink: 0;
  display: inline-flex;
  color: var(--brand);
  opacity: 0;
}
.tsw-option.is-active .tsw-check { opacity: 1; }

.tsw-reset {
  width: 100%;
  margin-top: var(--space-2);
  padding: 9px;
  border: none;
  border-top: 1px solid var(--border-subtle);
  border-radius: 0;
  background: none;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
  cursor: pointer;
}
.tsw-reset:hover { color: var(--brand); }
.tsw-reset:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }

.tsw-forced {
  margin: var(--space-2) 0 2px;
  padding: 0 10px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-3);
}

/* ── 浮层内（移动端）── */
.tsw--sheet { width: 100%; }
.tsw--sheet .tsw-trigger {
  width: 100%;
  height: 44px;
  justify-content: flex-start;
  border-color: var(--border-color);
}
.tsw--sheet .tsw-caret { margin-left: auto; }
.tsw--sheet .tsw-panel {
  position: static;
  width: 100%;
  margin-top: 6px;
  box-shadow: none;
  background: var(--bg-sunken);
}

/* 窄屏：导航条上省掉「界面风格」字，只留图标 + 当前主题名。
   375px 上放着「商家登录」和品牌名，四个字挤不下。 */
@media (max-width: 767px) {
  .tsw--nav .tsw-label { display: none; }
  .tsw--nav .tsw-current { border-left: none; padding-left: 0; }
}

/* 面板进入动效：只动 opacity 与 transform，不碰 box-shadow/backdrop-filter */
@media (prefers-reduced-motion: no-preference) {
  .tsw-panel { animation: tswIn var(--duration-2) var(--ease-out) both; }
  @keyframes tswIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}
</style>
