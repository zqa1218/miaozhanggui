<script setup>
// 样式加载顺序即优先级，不要调换：
//   1. tokens.primitives —— L1 原语：原子值，永不随主题变
//   2. tokens.semantic   —— L2 语义：classic 快照 + glass 覆盖 + 降级块
//   3. element-bridge    —— Element Plus 运行时变量桥 + 结构覆盖
//   4. theme             —— 语义组件层（按钮/面板/徽章/容器）
//   5. global            —— 页面级构件与历史兼容类
//   6. glass             —— glass 主题专属：背景层 + .glass 系列工具类
// 这七份 CSS 在 element-plus 自身的样式之后加载，因此同权重选择器本就能赢，
// 无需依赖 !important。glass 放最后：它的工具类需要压过组件层的同权重规则。
//
// 注意：L2 必须在 element-bridge 之前 —— 桥接层引用 --radius-* / --shadow-*
// 等语义令牌，而自定义属性的解析与声明顺序无关（只与层叠结果有关），
// 但保持「先定义后引用」的顺序能让 devtools 的 computed 面板更易读。
import '@/assets/styles/tokens.primitives.css'
import '@/assets/styles/tokens.semantic.css'
import '@/assets/styles/element-bridge.css'
import '@/assets/styles/theme.css'
import '@/assets/styles/global.css'
import '@/assets/styles/glass.css'
import '@/assets/styles/glass-app.css'
//   7. fx                —— 生产护栏：降级与无障碍偏好（最后加载，用来推翻前面的值）
import '@/assets/styles/fx.css'

// 降级状态的运行时维护（首帧判定在 index.html 的内联脚本里做）。
// 挂在根组件上：整个应用生命周期内都要跟随系统的「减少动态效果 / 增强对比度」变化。
import { useFx } from '@/composables/useFx'
useFx()
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
