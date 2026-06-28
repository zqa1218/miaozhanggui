<template>
  <div class="wizard-view fade-in-up">
    <div class="section-box">
      <!-- 步骤指示器 -->
      <div class="steps-indicator">
        <div class="step-dot" :class="{ active: store.currentStep >= 1, done: store.currentStep > 1 }">
          <span>1</span>
        </div>
        <div class="step-line" :class="{ fill: store.currentStep > 1 }"></div>
        <div class="step-dot" :class="{ active: store.currentStep >= 2, done: store.currentStep > 2 }">
          <span>2</span>
        </div>
        <div class="step-line" :class="{ fill: store.currentStep > 2 }"></div>
        <div class="step-dot" :class="{ active: store.currentStep >= 3 }">
          <span>3</span>
        </div>
      </div>
      <div class="steps-label">
        <span :class="{ on: store.currentStep === 1 }">基础信息</span>
        <span :class="{ on: store.currentStep === 2 }">时间轴配置</span>
        <span :class="{ on: store.currentStep === 3 }">计价与完成</span>
      </div>

      <!-- 步骤内容 -->
      <component :is="currentComponent" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStudioCreateStore } from '@/stores/studioCreate'
import StudioCreateStep1 from './StudioCreateStep1.vue'
import StudioCreateStep2 from './StudioCreateStep2.vue'
import StudioCreateStep3 from './StudioCreateStep3.vue'

const route = useRoute()
const store = useStudioCreateStore()

const stepComponents = {
  1: StudioCreateStep1,
  2: StudioCreateStep2,
  3: StudioCreateStep3,
}

const currentComponent = computed(() => stepComponents[store.currentStep])

onMounted(() => {
  store.reset()
  if (route.params.id) {
    // 编辑模式: TODO 加载已有项目数据
  }
})

onUnmounted(() => store.reset())
</script>

<style scoped>
.wizard-view { max-width: 780px; margin: 0 auto; }
.section-box {
  background: var(--bg-card, #fff);
  border-radius: 16px;
  padding: 28px 32px;
  box-shadow: 0 2px 12px rgba(0,0,0,.04);
}

.steps-indicator { display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
.step-dot {
  width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: #F4F2EE; color: #B0B0B0; font-weight: 700; font-size: 14px;
  transition: all 0.25s ease;
}
.step-dot.active {
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  color: #fff;
  box-shadow: 0 0 20px rgba(244,164,96,0.25);
}
.step-dot.done { background: #A8D8B9; color: #fff; }
.step-line { width: 60px; height: 3px; background: #E8E5DF; margin: 0 4px; border-radius: 3px; transition: background 0.4s ease; }
.step-line.fill { background: #F4A460; }

.steps-label { display: flex; justify-content: center; gap: 90px; margin-bottom: 28px; font-size: 13px; color: #B0B0B0; }
.steps-label .on { color: #D4893E; font-weight: 700; }
</style>
