/**
 * UI 主题 Store
 *
 * 管理三个主题模式：软萌（默认）、经典（SaaS风格）、科技（未来感）
 * CSS 变量统一在此维护，切换时同步写入 document.documentElement
 * 选择持久化到 localStorage
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage } from '@/utils/storage'

const STORAGE_KEY = 'app_ui_theme'

/* ═══════════════════════════════════════════════════════════════════
   三套主题完整 CSS 变量定义
   ═══════════════════════════════════════════════════════════════════ */

const THEMES = {
  /* ─── 软萌 · 日系简约温暖 ─── */
  'soft-cute': {
    label: '软萌',
    description: '温暖米白 · 大圆角 · 宽松留白',
    layout: 'top-tab', // 顶部 Tab 导航
    sidebar: {
      bg: '#FFFFFF',
      textColor: '#8E8E8E',
      activeBg: '#FEF3E4',
      activeColor: '#D4893E',
      hoverBg: '#FEF3E4',
      width: '220px',
    },
    variables: {
      /* 主色 — 暖杏橙 */
      '--color-primary': '#F4A460',
      '--color-primary-light': '#F7C57C',
      '--color-primary-dark': '#D4893E',
      '--color-primary-gradient': 'linear-gradient(135deg, #F4A460 0%, #F7C57C 100%)',

      /* 辅色 */
      '--color-secondary': '#F9E0A0',
      '--color-tertiary': '#A8D8B9',
      '--color-quaternary': '#EFA8A8',
      '--color-info': '#A9C1D9',

      '--color-sakura': '#EFA8A8',
      '--color-sakura-light': '#FDF2F2',
      '--color-sky': '#A9C1D9',
      '--color-sky-light': '#F0F4F8',
      '--color-mint': '#A8D8B9',
      '--color-mint-light': '#EDF6F0',
      '--color-peach': '#F4A460',
      '--color-peach-light': '#FEF7EF',

      /* 状态色 */
      '--color-success': '#A8D8B9',
      '--color-success-bg': '#EDF6F0',
      '--color-warning': '#F9E0A0',
      '--color-warning-bg': '#FEF9ED',
      '--color-danger': '#EFA8A8',
      '--color-danger-bg': '#FDF2F2',
      '--color-info-bg': '#F0F4F8',
      '--color-disabled': '#D4CFC8',
      '--color-disabled-bg': '#F4F2EE',

      /* 文字 */
      '--text-primary': '#4A4A4A',
      '--text-secondary': '#8E8E8E',
      '--text-sub': '#8E8E8E',
      '--text-placeholder': '#B0B0B0',
      '--text-inverse': '#ffffff',

      /* 背景 */
      '--bg-page': '#F9F8F6',
      '--bg-card': '#FFFFFF',
      '--bg-card-solid': '#FFFFFF',
      '--bg-glass': '#FFFFFF',
      '--bg-glass-heavy': '#FFFFFF',
      '--bg-input': '#FFFFFF',
      '--bg-table-stripe': '#FDFBF7',

      /* 边框 */
      '--border-color': '#E8E5DF',
      '--border-color-solid': '#E8E5DF',

      /* 圆角 — 大圆角胶囊 */
      '--radius-sm': '10px',
      '--radius-md': '14px',
      '--radius-lg': '24px',
      '--radius-xl': '32px',
      '--radius-2xl': '36px',
      '--radius-pill': '9999px',
      '--radius-btn': '28px',

      /* Element Plus 组件级圆角 */
      '--el-border-radius-base': '10px',
      '--el-border-radius-small': '6px',
      '--el-border-radius-round': '20px',
      '--el-border-radius-circle': '50%',
      '--el-card-border-radius': '14px',
      '--el-dialog-border-radius': '16px',
      '--el-tag-border-radius': '20px',
      '--el-button-border-radius': '28px',
      '--el-input-border-radius': '10px',
      '--el-popover-border-radius': '14px',
      '--el-message-border-radius': '12px',

      /* 阴影 — 轻柔 */
      '--shadow-xs': '0 1px 4px rgba(0,0,0,.03)',
      '--shadow-sm': '0 2px 8px rgba(0,0,0,.03)',
      '--shadow-md': '0 6px 20px rgba(0,0,0,.05)',
      '--shadow-lg': '0 12px 36px rgba(0,0,0,.07)',
      '--shadow-xl': '0 16px 48px rgba(0,0,0,.10)',
      '--shadow-glow': '0 0 28px rgba(244,164,96,.18)',
      '--shadow-hover': '0 8px 28px rgba(0,0,0,.08), 0 2px 10px rgba(0,0,0,.04)',

      /* 玻璃效果 */
      '--glass-blur': 'none',
      '--glass-blur-heavy': 'none',
      '--glass-blur-light': 'none',
      '--glass-bg': '#FFFFFF',
      '--glass-bg-hover': '#FEFBF6',
      '--glass-border': '#E8E5DF',
      '--glass-box-shadow': '0 6px 20px rgba(0,0,0,.05)',
      '--glass-box-shadow-hover': '0 8px 28px rgba(0,0,0,.08), 0 2px 10px rgba(0,0,0,.04)',

      /* 动画 — 日系弹性 */
      '--ease-out': 'cubic-bezier(0.25, 0.8, 0.25, 1)',
      '--ease-in-out': 'cubic-bezier(0.42, 0, 0.58, 1)',
      '--ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      '--duration-fast': '150ms',
      '--duration-normal': '250ms',
      '--duration-slow': '400ms',
      '--transition-fast': '0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
      '--transition-smooth': '0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
      '--transition-spring': '0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',

      /* 间距 */
      '--space-xs': '8px',
      '--space-sm': '16px',
      '--space-md': '24px',
      '--space-lg': '36px',
      '--space-xl': '48px',

      /* 字体 */
      '--font-stack': "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Hiragino Sans', 'Yu Gothic', sans-serif",
      '--font-mono': "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",

      /* 旧别名兼容 */
      '--purple': '#F4A460',
      '--purple-light': '#F7C57C',
      '--sakura': '#F9E0A0',
      '--sky': '#A9C1D9',
      '--mint': '#A8D8B9',
      '--peach': '#EFA8A8',
      '--danger': '#EFA8A8',
      '--danger-light': '#FDF2F2',
      '--text': '#4A4A4A',
      '--sub': '#8E8E8E',
      '--border': '#E8E5DF',
      '--card-bg': '#FFFFFF',
      '--glass': '#FFFFFF',

      /* 额外元信息 */
      '--theme-body-bg': '#F9F8F6',
      '--theme-body-before-gradient': 'radial-gradient(circle, rgba(244,164,96,0.05) 0%, rgba(249,224,160,0.03) 40%, transparent 70%)',
      '--theme-body-after-gradient': 'radial-gradient(circle, rgba(168,216,185,0.04) 0%, rgba(244,164,96,0.02) 40%, transparent 70%)',
      '--theme-nav-bg': '#FFFFFF',
      '--theme-nav-shadow': '0 2px 16px rgba(0,0,0,0.04)',

      /* Element Plus 按钮渐变覆盖 */
      '--el-btn-primary-bg': 'linear-gradient(135deg, #F4A460, #F7C57C)',
      '--el-btn-primary-shadow': '0 4px 16px rgba(244,164,96,0.20), 0 1px 3px rgba(0,0,0,.04)',
      '--el-btn-primary-hover-shadow': '0 8px 24px rgba(244,164,96,0.28), 0 2px 6px rgba(0,0,0,.05)',
    },
  },

  /* ─── 经典 · SaaS 平台风 — 暖金商务 ─── */
  classic: {
    label: '经典',
    description: '暖金商务 · 深色侧栏 · 干净利落',
    layout: 'sidebar', // 左侧深色导航栏
    sidebar: {
      bg: '#1A1A1A',
      textColor: '#B0B0B0',
      activeBg: 'rgba(218, 165, 32, 0.15)',
      activeColor: '#DAA520',
      hoverBg: 'rgba(255,255,255,0.05)',
      width: '230px',
      divider: 'rgba(255,255,255,0.08)',
      logoColor: '#FFFFFF',
      logoAccent: '#DAA520',
    },
    variables: {
      /* 主色 — 暖金色（参考像素本/轻云） */
      '--color-primary': '#B8860B',
      '--color-primary-light': '#DAA520',
      '--color-primary-dark': '#8B6914',
      '--color-primary-gradient': 'linear-gradient(180deg, #DAA520 0%, #B8860B 100%)',

      /* 辅色 — 商务灰调 */
      '--color-secondary': '#C9A84C',
      '--color-tertiary': '#2E7D32',
      '--color-quaternary': '#D4843A',
      '--color-info': '#5C7CFA',

      '--color-sakura': '#E8734A',
      '--color-sakura-light': '#FDF2EE',
      '--color-sky': '#5C7CFA',
      '--color-sky-light': '#EEF1FF',
      '--color-mint': '#2E7D32',
      '--color-mint-light': '#EDF7EE',
      '--color-peach': '#DAA520',
      '--color-peach-light': '#FEF9EE',

      /* 状态色 */
      '--color-success': '#2E7D32',
      '--color-success-bg': '#EDF7EE',
      '--color-warning': '#D4843A',
      '--color-warning-bg': '#FEF5EE',
      '--color-danger': '#D32F2F',
      '--color-danger-bg': '#FEF0F0',
      '--color-info-bg': '#EEF1FF',
      '--color-disabled': '#BDBDBD',
      '--color-disabled-bg': '#F5F5F5',

      /* 文字 — 加深对比度 */
      '--text-primary': '#1A1A1A',
      '--text-secondary': '#616161',
      '--text-sub': '#757575',
      '--text-placeholder': '#9E9E9E',
      '--text-inverse': '#FFFFFF',

      /* 背景 — 浅灰底 + 白色卡片 */
      '--bg-page': '#F0F0F0',
      '--bg-card': '#FFFFFF',
      '--bg-card-solid': '#FFFFFF',
      '--bg-glass': '#FFFFFF',
      '--bg-glass-heavy': '#FFFFFF',
      '--bg-input': '#FFFFFF',
      '--bg-table-stripe': '#FAFAFA',

      /* 边框 — 清晰的浅灰线 */
      '--border-color': '#E0E0E0',
      '--border-color-solid': '#D6D6D6',

      /* 圆角 — 标准商务 4px */
      '--radius-sm': '3px',
      '--radius-md': '4px',
      '--radius-lg': '6px',
      '--radius-xl': '8px',
      '--radius-2xl': '12px',
      '--radius-pill': '9999px',
      '--radius-btn': '4px',

      /* Element Plus 组件级圆角 */
      '--el-border-radius-base': '4px',
      '--el-border-radius-small': '3px',
      '--el-border-radius-round': '20px',
      '--el-border-radius-circle': '50%',
      '--el-card-border-radius': '6px',
      '--el-dialog-border-radius': '8px',
      '--el-tag-border-radius': '4px',
      '--el-button-border-radius': '4px',
      '--el-input-border-radius': '4px',
      '--el-popover-border-radius': '6px',
      '--el-message-border-radius': '6px',

      /* 阴影 — 轻微投影 */
      '--shadow-xs': '0 1px 2px rgba(0,0,0,.04)',
      '--shadow-sm': '0 1px 3px rgba(0,0,0,.06)',
      '--shadow-md': '0 2px 8px rgba(0,0,0,.06)',
      '--shadow-lg': '0 4px 16px rgba(0,0,0,.08)',
      '--shadow-xl': '0 8px 24px rgba(0,0,0,.10)',
      '--shadow-glow': '0 0 16px rgba(184,134,11,.15)',
      '--shadow-hover': '0 4px 12px rgba(0,0,0,.08)',

      /* 玻璃效果 — 无 */
      '--glass-blur': 'none',
      '--glass-blur-heavy': 'none',
      '--glass-blur-light': 'none',
      '--glass-bg': '#FFFFFF',
      '--glass-bg-hover': '#FDFAF0',
      '--glass-border': '#E0E0E0',
      '--glass-box-shadow': '0 2px 8px rgba(0,0,0,.06)',
      '--glass-box-shadow-hover': '0 4px 12px rgba(0,0,0,.08)',

      /* 动画 — 标准线性 */
      '--ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
      '--ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      '--ease-spring': 'cubic-bezier(0.4, 0, 0.2, 1)',
      '--duration-fast': '100ms',
      '--duration-normal': '200ms',
      '--duration-slow': '300ms',
      '--transition-fast': '0.15s cubic-bezier(0, 0, 0.2, 1)',
      '--transition-smooth': '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      '--transition-spring': '0.25s cubic-bezier(0.4, 0, 0.2, 1)',

      /* 间距 — 适度紧凑 */
      '--space-xs': '4px',
      '--space-sm': '12px',
      '--space-md': '20px',
      '--space-lg': '28px',
      '--space-xl': '40px',

      /* 字体 — 系统字体 */
      '--font-stack': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      '--font-mono': "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",

      /* 旧别名兼容 */
      '--purple': '#B8860B',
      '--purple-light': '#DAA520',
      '--sakura': '#C9A84C',
      '--sky': '#5C7CFA',
      '--mint': '#2E7D32',
      '--peach': '#D4843A',
      '--danger': '#D32F2F',
      '--danger-light': '#FEF0F0',
      '--text': '#1A1A1A',
      '--sub': '#757575',
      '--border': '#E0E0E0',
      '--card-bg': '#FFFFFF',
      '--glass': '#FFFFFF',

      /* 额外元信息 — 浅灰背景+无环境光 */
      '--theme-body-bg': '#F0F0F0',
      '--theme-body-before-gradient': 'none',
      '--theme-body-after-gradient': 'none',
      '--theme-nav-bg': '#1A1A1A',
      '--theme-nav-shadow': '0 2px 8px rgba(0,0,0,0.15)',

      /* Element Plus 按钮渐变覆盖 */
      '--el-btn-primary-bg': 'linear-gradient(180deg, #DAA520, #B8860B)',
      '--el-btn-primary-shadow': '0 2px 4px rgba(184,134,11,0.15)',
      '--el-btn-primary-hover-shadow': '0 4px 8px rgba(184,134,11,0.25)',
    },
  },

  /* ─── 科技 · 暗色液态玻璃 ─── */
  'futuristic': {
    label: '科技',
    description: '液态玻璃 · 深色低饱和 · 全透明卡片',
    layout: 'sidebar',
    sidebar: {
      bg: 'rgba(10, 14, 18, 0.92)',
      textColor: '#5C6670',
      activeBg: 'rgba(90, 130, 155, 0.12)',
      activeColor: '#8AABBE',
      hoverBg: 'rgba(255,255,255,0.03)',
      width: '230px',
      divider: 'rgba(255,255,255,0.05)',
      logoColor: '#BCC6CE',
      logoAccent: '#7D97A8',
    },
    variables: {
      /* 主色 — 低饱和灰蓝，绝不鲜艳 */
      '--color-primary': '#6B8B9E',
      '--color-primary-light': '#8AABBE',
      '--color-primary-dark': '#4E6B7A',
      '--color-primary-gradient': 'linear-gradient(135deg, rgba(107,139,158,0.70) 0%, rgba(78,107,122,0.85) 100%)',

      /* 辅色 — 全部低饱和暗色 */
      '--color-secondary': '#5D7584',
      '--color-tertiary': '#5C7D6A',
      '--color-quaternary': '#7D6A5C',
      '--color-info': '#6A7D8C',

      '--color-sakura': '#7D655E',
      '--color-sakura-light': 'rgba(125,101,94,0.10)',
      '--color-sky': '#6B8B9E',
      '--color-sky-light': 'rgba(107,139,158,0.06)',
      '--color-mint': '#5C7D6A',
      '--color-mint-light': 'rgba(92,125,106,0.08)',
      '--color-peach': '#6E7D8A',
      '--color-peach-light': 'rgba(110,125,138,0.06)',

      /* 状态色 — 全部压低饱和度 */
      '--color-success': '#5C7D6A',
      '--color-success-bg': 'rgba(92,125,106,0.10)',
      '--color-warning': '#7D725C',
      '--color-warning-bg': 'rgba(125,114,92,0.10)',
      '--color-danger': '#7D5C5C',
      '--color-danger-bg': 'rgba(125,92,92,0.10)',
      '--color-info-bg': 'rgba(107,139,158,0.06)',
      '--color-disabled': '#2E353C',
      '--color-disabled-bg': 'rgba(46,53,60,0.30)',

      /* 文字 — 灰白系，绝不刺眼 */
      '--text-primary': '#C8D2D8',
      '--text-secondary': '#7D8992',
      '--text-sub': '#646E76',
      '--text-placeholder': '#475058',
      '--text-inverse': '#0D1115',

      /* 背景 — 深灰黑底 */
      '--bg-page': '#0B1015',
      /* ★ 核心：所有卡片/面板透明 */
      '--bg-card': 'rgba(24, 30, 36, 0.55)',
      '--bg-card-solid': 'rgba(24, 30, 36, 0.55)',
      '--bg-glass': 'rgba(24, 30, 36, 0.40)',
      '--bg-glass-heavy': 'rgba(24, 30, 36, 0.60)',
      '--bg-input': 'rgba(18, 23, 28, 0.60)',
      '--bg-table-stripe': 'rgba(28, 34, 40, 0.40)',

      /* 边框 — 半透明微光 */
      '--border-color': 'rgba(255,255,255,0.06)',
      '--border-color-solid': 'rgba(255,255,255,0.08)',

      /* 圆角 — 柔和流畅 */
      '--radius-sm': '6px',
      '--radius-md': '10px',
      '--radius-lg': '16px',
      '--radius-xl': '22px',
      '--radius-2xl': '28px',
      '--radius-pill': '9999px',
      '--radius-btn': '8px',

      /* Element Plus 组件级圆角 */
      '--el-border-radius-base': '10px',
      '--el-border-radius-small': '6px',
      '--el-border-radius-round': '16px',
      '--el-border-radius-circle': '50%',
      '--el-card-border-radius': '16px',
      '--el-dialog-border-radius': '20px',
      '--el-tag-border-radius': '8px',
      '--el-button-border-radius': '8px',
      '--el-input-border-radius': '10px',
      '--el-popover-border-radius': '16px',
      '--el-message-border-radius': '12px',

      /* 阴影 — 柔和分散 */
      '--shadow-xs': '0 1px 3px rgba(0,0,0,.30)',
      '--shadow-sm': '0 2px 10px rgba(0,0,0,.35)',
      '--shadow-md': '0 6px 24px rgba(0,0,0,.40)',
      '--shadow-lg': '0 12px 40px rgba(0,0,0,.45)',
      '--shadow-xl': '0 20px 60px rgba(0,0,0,.50)',
      '--shadow-glow': '0 0 30px rgba(107,139,158,.08)',
      '--shadow-hover': '0 8px 30px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.04)',

      /* ★ 玻璃核心 — backdrop-filter 实现液态玻璃 */
      '--glass-blur': 'blur(20px)',
      '--glass-blur-heavy': 'blur(32px)',
      '--glass-blur-light': 'blur(10px)',
      '--glass-bg': 'rgba(24, 30, 36, 0.40)',
      '--glass-bg-hover': 'rgba(30, 37, 44, 0.50)',
      '--glass-border': 'rgba(255,255,255,0.06)',
      '--glass-box-shadow': '0 6px 24px rgba(0,0,0,.40)',
      '--glass-box-shadow-hover': '0 8px 30px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.04)',

      /* 动画 — 丝滑流畅 */
      '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      '--ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
      '--ease-spring': 'cubic-bezier(0.25, 1.2, 0.5, 1)',
      '--duration-fast': '180ms',
      '--duration-normal': '280ms',
      '--duration-slow': '450ms',
      '--transition-fast': '0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      '--transition-smooth': '0.28s cubic-bezier(0.65, 0, 0.35, 1)',
      '--transition-spring': '0.4s cubic-bezier(0.25, 1.2, 0.5, 1)',

      /* 间距 — 均衡 */
      '--space-xs': '6px',
      '--space-sm': '14px',
      '--space-md': '22px',
      '--space-lg': '32px',
      '--space-xl': '44px',

      /* 字体 */
      '--font-stack': "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
      '--font-mono': "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",

      /* 旧别名兼容 */
      '--purple': '#6E7D8A',
      '--purple-light': '#8AABBE',
      '--sakura': '#7D655E',
      '--sky': '#6B8B9E',
      '--mint': '#5C7D6A',
      '--peach': '#7D725C',
      '--danger': '#7D5C5C',
      '--danger-light': 'rgba(125,92,92,0.10)',
      '--text': '#C8D2D8',
      '--sub': '#646E76',
      '--border': 'rgba(255,255,255,0.06)',
      '--card-bg': 'rgba(24, 30, 36, 0.55)',
      '--glass': 'rgba(24, 30, 36, 0.40)',

      /* 额外元信息 */
      '--theme-body-bg': '#0B1015',
      '--theme-body-before-gradient': 'radial-gradient(ellipse at 20% 10%, rgba(107,139,158,0.04) 0%, transparent 60%)',
      '--theme-body-after-gradient': 'radial-gradient(ellipse at 80% 90%, rgba(92,125,106,0.03) 0%, transparent 60%)',
      '--theme-nav-bg': 'rgba(10, 14, 18, 0.92)',
      '--theme-nav-shadow': '0 1px 0 rgba(255,255,255,.04), 0 4px 30px rgba(0,0,0,.40)',

      /* Element Plus 按钮 — 低饱和半透明 */
      '--el-btn-primary-bg': 'linear-gradient(135deg, rgba(107,139,158,0.70), rgba(78,107,122,0.85))',
      '--el-btn-primary-shadow': '0 2px 12px rgba(0,0,0,.30)',
      '--el-btn-primary-hover-shadow': '0 4px 20px rgba(0,0,0,.40), 0 0 0 1px rgba(255,255,255,.04)',
    },
  },
}

/* ═══════════════════════════════════════════════════════════════════
   Store 定义
   ═══════════════════════════════════════════════════════════════════ */

export const useThemeStore = defineStore('theme', () => {
  const current = ref('soft-cute')
  const isTransitioning = ref(false) // 主题切换动画进行中

  const currentLabel = computed(() => THEMES[current.value]?.label || '软萌')
  const currentDescription = computed(() => THEMES[current.value]?.description || '')
  const currentLayout = computed(() => THEMES[current.value]?.layout || 'top-tab')
  const currentSidebar = computed(() => THEMES[current.value]?.sidebar || {})
  const allThemes = computed(() =>
    Object.entries(THEMES).map(([key, t]) => ({
      key,
      label: t.label,
      description: t.description,
      layout: t.layout,
      active: key === current.value,
    })),
  )

  /** 将选中主题的 CSS 变量写入 documentElement（无动画，直接写入） */
  function applyTheme(key) {
    const theme = THEMES[key]
    if (!theme) return

    const root = document.documentElement
    // 先清理所有主题变量（仅清理我们设置过的）
    Object.values(THEMES).forEach((t) => {
      Object.keys(t.variables).forEach((varName) => {
        root.style.removeProperty(varName)
      })
    })

    // 写入新变量
    Object.entries(theme.variables).forEach(([varName, value]) => {
      root.style.setProperty(varName, value)
    })

    // 动态注入 body 环境光
    const body = document.body
    if (body) {
      body.style.background = theme.variables['--theme-body-bg'] || body.style.background

      // 清理旧伪元素，通过 data 属性控制
      body.setAttribute('data-theme', key)
    }
  }

  /** 切换主题（带动画过渡） */
  async function switchTo(key) {
    if (!THEMES[key] || isTransitioning.value) return
    const oldKey = current.value
    if (oldKey === key) return

    isTransitioning.value = true
    current.value = key
    storage.set(STORAGE_KEY, key)

    // 1. 注入过渡遮罩层
    const overlay = document.createElement('div')
    overlay.className = 'theme-transition-overlay'
    // 使用当前主题的背景色作为遮罩色
    const oldBg = THEMES[oldKey]?.variables?.['--theme-body-bg'] || '#F9F8F6'
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: ${oldBg};
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    `
    document.body.appendChild(overlay)

    // 2. 下一帧：淡入遮罩（完全覆盖当前页面）
    await nextFrame()
    overlay.style.opacity = '1'

    // 3. 等待遮罩完全覆盖
    await wait(350)

    // 4. 在遮罩下写入新主题变量
    applyTheme(key)

    // 5. 短暂停留让新样式渲染
    await nextFrame()
    await wait(50)

    // 6. 淡出遮罩，露出新主题
    overlay.style.opacity = '0'

    // 7. 等待淡出完成，清理
    await wait(350)
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay)

    isTransitioning.value = false
  }

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve))
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /** 初始化：从 localStorage 恢复 */
  function init() {
    const saved = storage.get(STORAGE_KEY)
    if (saved && THEMES[saved]) {
      current.value = saved
    }
    applyTheme(current.value)
  }

  return {
    current,
    currentLabel,
    currentDescription,
    currentLayout,
    currentSidebar,
    isTransitioning,
    allThemes,
    switchTo,
    init,
    THEMES, // 暴露只读引用
  }
})
