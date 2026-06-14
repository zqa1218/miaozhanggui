<template>
  <div class="fade-in-up step-content">
    <!-- 区块：开放日期 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">开放日期</span>
      </template>

      <OpenDateSelector
        v-model:all-time="store.step2.isAllTimeOpen"
        v-model:dates="store.step2.selectedDates"
      />
    </el-card>

    <!-- 区块：工作时间轴 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">工作时间轴</span>
      </template>

      <el-form-item label="工作起始时间">
        <el-time-select
          v-model="store.step2.baseStartTime"
          :max-time="store.step2.baseEndTime"
          start="00:00" step="00:30" end="23:30"
          placeholder="起始时间"
        />
      </el-form-item>
      <el-form-item label="工作结束时间">
        <el-time-select
          v-model="store.step2.baseEndTime"
          :min-time="store.step2.baseStartTime"
          start="00:00" step="00:30" end="23:30"
          placeholder="结束时间"
        />
      </el-form-item>
      <el-form-item label="每单间隔休息">
        <el-input-number v-model="store.step2.intervalRestTime" :min="0" :max="120" />
        <span class="unit-suffix">分钟</span>
      </el-form-item>
    </el-card>

    <!-- 区块：休息时段 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">休息时段</span>
      </template>

      <div v-for="(slot, idx) in store.step2.restSlots" :key="idx" class="rest-slot-row">
        <el-time-select v-model="slot.startTime" start="00:00" step="00:30" end="23:30" placeholder="起" />
        <span class="rest-sep">至</span>
        <el-time-select v-model="slot.endTime" start="00:00" step="00:30" end="23:30" placeholder="止" />
        <el-button type="danger" size="small" circle @click="store.step2.restSlots.splice(idx, 1)">
          <i class="fa-solid fa-xmark"></i>
        </el-button>
      </div>
      <el-button size="small" @click="store.step2.restSlots.push({ startTime: '12:00', endTime: '13:00' })">
        + 添加休息时段
      </el-button>

      <el-divider />

      <el-form-item label="复刻到所有日期">
        <el-switch v-model="store.step2.isReplicated" />
        <span class="hint ml2">{{ store.step2.isReplicated ? '将时间规则应用到所有可选日期' : '仅当前日期' }}</span>
      </el-form-item>
    </el-card>

    <!-- 底部操作 -->
    <div class="step-footer">
      <el-button @click="store.prevStep()" size="large">上一步</el-button>
      <el-button type="primary" @click="store.nextStep()" size="large">下一步</el-button>
    </div>
  </div>
</template>

<script setup>
import { useStudioCreateStore } from '@/stores/studioCreate'
import OpenDateSelector from '@/components/shared/OpenDateSelector.vue'

const store = useStudioCreateStore()
</script>

<style scoped>
.step-content {
  max-width: 780px;
}

/* 卡片 */
.step-card {
  margin-bottom: 20px;
  border-radius: 12px;
  border: 1px solid #F0EDE8;
}
.step-card :deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid #F0EDE8;
  background: #FDFBF7;
  border-radius: 12px 12px 0 0;
}
.step-card :deep(.el-card__body) {
  padding: 20px;
}

.card-header-title {
  font-size: 16px;
  font-weight: 700;
  color: #4A4A4A;
}

/* 休息时段行 */
.rest-slot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.rest-sep {
  color: #B0B0B0;
  font-size: 13px;
}

/* 通用 */
.ml2 { margin-left: 8px; }
.unit-suffix {
  margin-left: 8px;
  font-size: 13px;
  color: #8E8E8E;
}

/* 统一 el-form-item 间距 */
:deep(.el-form-item) {
  margin-bottom: 18px;
}
:deep(.el-form-item__label) {
  font-weight: 600;
  color: #4A4A4A;
}

/* 底部操作栏 */
.step-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  padding: 0 4px;
}
</style>
