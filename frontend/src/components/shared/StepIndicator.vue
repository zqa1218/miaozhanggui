<script setup>
defineProps({
  steps: { type: Array, required: true },
  current: { type: Number, required: true },
})
</script>

<template>
  <div class="step-indicator">
    <template v-for="(step, i) in steps" :key="i">
      <div class="step-item">
        <div class="step-dot" :class="{ done: i+1<current, active: i+1===current }">
          <span v-if="i+1<current">&#10003;</span><span v-else>{{ i+1 }}</span>
        </div>
        <div class="step-label" :class="{ active: i+1===current }">{{ step.label }}</div>
      </div>
      <div v-if="i<steps.length-1" class="step-line" :class="{ done: i+1<current }"></div>
    </template>
  </div>
</template>

<style scoped>
.step-indicator {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 16px 20px;
  margin-bottom: 32px;
  gap: 0;
}
.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  background: #F4F2EE;
  color: #B0B0B0;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 2;
}
.step-dot.active {
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  color: #fff;
  box-shadow: 0 0 24px rgba(244,164,96,0.28);
  transform: scale(1.18);
}
.step-dot.done {
  background: #A8D8B9;
  color: #fff;
}
.step-line {
  flex: 1;
  height: 3px;
  min-width: 24px;
  background: #E8E5DF;
  border-radius: 3px;
  margin-top: 15px;
  transition: background 0.5s ease;
}
.step-line.done {
  background: linear-gradient(90deg, #A8D8B9, #F4A460, #A8D8B9);
}
.step-label {
  font-size: 11px;
  color: #B0B0B0;
  margin-top: 6px;
  text-align: center;
  white-space: nowrap;
  transition: color 0.3s, font-weight 0.3s;
}
.step-label.active {
  color: #D4893E;
  font-weight: 700;
}

/* 手机端：竖向步骤 */
@media (max-width: 767px) {
  .step-indicator {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: 8px 12px;
    margin-bottom: 20px;
  }
  .step-item {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    width: 100%;
  }
  .step-dot {
    width: 28px; height: 28px;
    font-size: 12px;
  }
  .step-line {
    width: 3px; height: 20px;
    min-width: 0; min-height: 16px;
    margin-top: 0; margin-left: 13px;
    flex: none;
  }
  .step-label {
    white-space: normal;
    font-size: 12px;
    margin-top: 0;
  }
}
</style>
