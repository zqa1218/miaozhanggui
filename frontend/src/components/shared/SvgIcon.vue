<script setup>
/**
 * SVG 图标组件
 *
 * 为什么用内联而不是 <img>：
 * 设计交付的线性图标全部用 stroke="currentColor"，颜色由父级文字色决定
 * （见《设计说明》3.1）。<img> 引用是独立渲染上下文，拿不到页面的 CSS，
 * currentColor 会退化成黑色 —— 必须内联才能继承颜色。
 *
 * 图标文件在构建时被打包进来（不是运行时请求），所以 v-html 是安全的：
 * 内容是我们自己的 SVG 资源，不含任何用户输入。
 */
import { computed } from 'vue'

const props = defineProps({
  /** 图标名，对应 src/assets/icons/<name>.svg */
  name: { type: String, required: true },
  /** 尺寸，数字按 px 处理 */
  size: { type: [Number, String], default: 18 },
  /** 无障碍标签；不传则视为纯装饰，对读屏隐藏 */
  label: { type: String, default: '' },
})

// eager + ?raw：构建时把所有图标作为字符串打进来
const modules = import.meta.glob('@/assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const raw = computed(() => {
  const key = Object.keys(modules).find((k) => k.endsWith(`/${props.name}.svg`))
  if (!key) {
    if (import.meta.env.DEV) console.warn(`[SvgIcon] 未找到图标: ${props.name}`)
    return ''
  }
  return modules[key]
})

const px = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <span
    class="svg-icon"
    :style="{ width: px, height: px }"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    v-html="raw"
  />
</template>

<style scoped>
.svg-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* 颜色继承自父级，图标内用的是 currentColor */
  color: inherit;
  /* 与 Element Plus 图标一致的基线对齐 */
  vertical-align: -0.15em;
}
.svg-icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
