<script setup>
/**
 * 空状态插画组件
 *
 * 与 SvgIcon 同源（构建时内联），区别是插画自带调色板、不继承颜色，
 * 所以不做 currentColor 处理，只控制尺寸。
 *
 * 设计规范：插画 240×180，无文字（文案由页面叠加，且文字色不超过 --text-3）。
 */
import { computed } from 'vue'

const props = defineProps({
  /** 插画名，对应 src/assets/illustrations/<name>.svg */
  name: { type: String, required: true },
  /** 显示宽度，高度按 4:3 自动 */
  width: { type: [Number, String], default: 160 },
  alt: { type: String, default: '' },
})

const modules = import.meta.glob('@/assets/illustrations/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const raw = computed(() => {
  const key = Object.keys(modules).find((k) => k.endsWith(`/${props.name}.svg`))
  if (!key) {
    if (import.meta.env.DEV) console.warn(`[AppIllustration] 未找到插画: ${props.name}`)
    return ''
  }
  return modules[key]
})

const w = computed(() => (typeof props.width === 'number' ? `${props.width}px` : props.width))
</script>

<template>
  <span
    class="illustration"
    :style="{ width: w }"
    :role="alt ? 'img' : undefined"
    :aria-label="alt || undefined"
    :aria-hidden="alt ? undefined : 'true'"
    v-html="raw"
  />
</template>

<style scoped>
.illustration {
  display: block;
  margin: 0 auto;
  line-height: 0;
}
.illustration :deep(svg) {
  width: 100%;
  height: auto;
  display: block;
}
</style>
