<script setup>
/**
 * 主题切换开关。
 *
 * 无障碍设计（这是验收项，不是加分项）：
 *   · 用真实 <button>，天然可 Tab 聚焦、可 Enter/Space 触发，无需自实现键盘处理；
 *   · aria-pressed 表示「玻璃主题是否开启」，**标签文字固定不变** ——
 *     如果标签随状态改变（经典↔玻璃）再叠加 aria-pressed，读屏会念出
 *     自相矛盾的信息。这是切换按钮最常见的无障碍错误。
 *   · 开关的视觉状态（滑块位置 + 颜色）不单独传达信息，文字标签始终在；
 *   · 焦点环用 :focus-visible，鼠标点击不出现，键盘导航必然出现。
 *
 * 动效：只过渡 transform 与 background-color。prefers-reduced-motion 下
 * theme.css 已全局把 transition-duration 压到 .01ms，这里无需重复处理。
 */
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { theme, setTheme } = useTheme()

const isGlass = computed(() => theme.value === 'glass')

function toggle() {
  setTheme(isGlass.value ? 'classic' : 'glass')
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-pressed="isGlass"
    :title="isGlass ? '当前：玻璃主题' : '当前：经典主题'"
    @click="toggle"
  >
    <span class="tt-track" aria-hidden="true"><span class="tt-knob"></span></span>
    <span class="tt-label">玻璃主题</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px 0 10px;
  border: 1px solid var(--glass-stroke);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--duration-1) var(--ease-out),
              border-color var(--duration-1) var(--ease-out);
}

.theme-toggle:hover {
  color: var(--text-1);
  border-color: var(--brand);
}

/* 焦点环：2px 实线 + 2px 偏移，在任何底色上都可见 */
.theme-toggle:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

.tt-track {
  position: relative;
  width: 30px;
  height: 16px;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  background: var(--bg-sunken);
  border: 1px solid var(--glass-stroke);
}

.tt-knob {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-4);
  /* 只动 transform —— 不动 box-shadow / backdrop-filter */
  transition: transform var(--duration-2) var(--ease-out),
              background-color var(--duration-1) var(--ease-out);
}

.theme-toggle[aria-pressed="true"] {
  color: var(--text-1);
  border-color: var(--brand);
}

.theme-toggle[aria-pressed="true"] .tt-track {
  background: var(--brand);
  border-color: var(--brand);
}

.theme-toggle[aria-pressed="true"] .tt-knob {
  transform: translateX(14px);
  background: var(--text-inverse);
}

/* 375px 下只留开关，省掉文字标签 —— 导航条横向空间要留给「商家登录」。
   标签在 DOM 里保留，用视觉隐藏而非 display:none，读屏仍可读出按钮含义。 */
@media (max-width: 479px) {
  .tt-label {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .theme-toggle { padding: 0 9px; gap: 0; }
}
</style>
