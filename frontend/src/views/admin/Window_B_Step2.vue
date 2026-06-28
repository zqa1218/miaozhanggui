<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWizardBStore } from '@/stores/wizardB'

const router = useRouter()
const store = useWizardBStore()

onMounted(() => {
  if (store.selectedDates.length === 0 && !store.isAllTimeOpen) {
    router.replace('/admin/studio/create/step1')
  }
})

// ---- 工作时间轴 ----
const baseStartTime = ref(store.baseStartTime || '09:00')
const baseEndTime   = ref(store.baseEndTime || '18:00')
const intervalRestTime = ref(store.intervalRestTime || 15)

// ---- 每日营业时间 ----
const defaultOpen  = ref('09:00')
const defaultClose = ref('18:00')

function buildDailyHours() {
  const init = {}
  for (const d of store.selectedDates) {
    init[d] = store.dailyHours[d] || { open: '09:00', close: '18:00' }
  }
  return init
}
const dailyHours = ref(buildDailyHours())

// ---- 休息段 ----
const DAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const restSlots = ref(
  store.restSlots.length > 0
    ? [...store.restSlots]
    : []
)

function addRestSlot() {
  restSlots.value.push({ day_of_week: null, start_time: '12:00', end_time: '13:00', reason: '' })
}

function removeRestSlot(idx) {
  restSlots.value.splice(idx, 1)
}

function applyToAllDates() {
  const oh = defaultOpen.value
  const ch = defaultClose.value
  for (const d of store.selectedDates) {
    dailyHours.value[d] = { open: oh, close: ch }
  }
}

function goNext() {
  store.baseStartTime = baseStartTime.value
  store.baseEndTime = baseEndTime.value
  store.intervalRestTime = intervalRestTime.value
  store.dailyHours = { ...dailyHours.value }
  store.restSlots = restSlots.value.filter(r => r.start_time && r.end_time)
  router.push('/admin/studio/create/step3')
}

function goBack() {
  store.baseStartTime = baseStartTime.value
  store.baseEndTime = baseEndTime.value
  store.intervalRestTime = intervalRestTime.value
  store.dailyHours = { ...dailyHours.value }
  store.restSlots = [...restSlots.value]
  router.push('/admin/studio/create/step1')
}
</script>

<template>
  <div class="step-page fade-in-up">
    <h2 class="step-title">创建项目 — 第2步：时间轴与休息段</h2>

    <!-- 卡片：工作时间轴 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">工作时间轴</span>
      </template>

      <el-form-item label="工作起始时间">
        <el-time-select
          v-model="baseStartTime"
          :max-time="baseEndTime"
          start="00:00" step="00:30" end="23:30"
          placeholder="起始时间"
        />
      </el-form-item>
      <el-form-item label="工作结束时间">
        <el-time-select
          v-model="baseEndTime"
          :min-time="baseStartTime"
          start="00:00" step="00:30" end="23:30"
          placeholder="结束时间"
        />
      </el-form-item>
      <el-form-item label="每单间隔休息">
        <el-input-number v-model="intervalRestTime" :min="0" :max="120" :step="5" />
        <span class="unit-suffix">分钟</span>
      </el-form-item>
    </el-card>

    <!-- 卡片：每日营业时间 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">每日营业时间</span>
      </template>

      <el-form-item label="全局模板">
        <div class="time-row-inline">
          <span class="time-label">开门</span>
          <el-time-select v-model="defaultOpen" start="00:00" step="00:30" end="23:30" placeholder="开门" />
          <span class="time-label">关门</span>
          <el-time-select v-model="defaultClose" start="00:00" step="00:30" end="23:30" placeholder="关门" />
          <el-button size="small" @click="applyToAllDates">一键复刻到所有已选日期</el-button>
        </div>
      </el-form-item>

      <el-divider />

      <el-form-item v-if="store.selectedDates.length > 0" label="逐日调整">
        <div class="daily-list">
          <div v-for="d in store.selectedDates" :key="d" class="daily-row">
            <el-tag size="small" type="info">{{ d }}</el-tag>
            <el-time-select v-model="dailyHours[d].open" start="00:00" step="00:30" end="23:30" size="small" />
            <span class="time-sep">—</span>
            <el-time-select v-model="dailyHours[d].close" start="00:00" step="00:30" end="23:30" size="small" />
          </div>
        </div>
      </el-form-item>
      <div v-else class="empty-hint">
        {{ store.isAllTimeOpen ? '全时段模式已开启，无需逐日配置' : '请先在步骤1选择开放日期' }}
      </div>
    </el-card>

    <!-- 卡片：休息段 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">固定休息段（按星期循环）</span>
      </template>

      <div v-for="(slot, idx) in restSlots" :key="idx" class="rest-row">
        <select v-model="slot.day_of_week" class="rest-select">
          <option :value="null">每天</option>
          <option v-for="(label, i) in DAY_LABELS" :key="i" :value="i">{{ label }}</option>
        </select>
        <el-time-select v-model="slot.start_time" start="00:00" step="00:30" end="23:30" placeholder="起" size="small" />
        <span class="time-sep">—</span>
        <el-time-select v-model="slot.end_time" start="00:00" step="00:30" end="23:30" placeholder="止" size="small" />
        <el-input v-model="slot.reason" placeholder="原因（如午休）" size="small" style="width:130px;" />
        <el-button type="danger" size="small" circle @click="removeRestSlot(idx)">
          <i class="fa-solid fa-xmark"></i>
        </el-button>
      </div>
      <el-button size="small" @click="addRestSlot" style="margin-top:4px;">+ 添加休息段</el-button>
    </el-card>

    <!-- 底部操作 -->
    <div class="step-footer">
      <el-button @click="goBack" size="large">上一步</el-button>
      <el-button type="primary" @click="goNext" size="large">下一步</el-button>
    </div>
  </div>
</template>

<style scoped>
.step-page {
  max-width: 780px;
  margin: 0 auto;
  padding: 8px 0 32px;
}
.step-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #4A4A4A);
  margin-bottom: 20px;
}

/* 卡片 */
.step-card {
  margin-bottom: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #F0EDE8);
}
.step-card :deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #F0EDE8);
  background: var(--bg-table-stripe, #FDFBF7);
  border-radius: 12px 12px 0 0;
}
.step-card :deep(.el-card__body) {
  padding: 20px;
}
.card-header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #4A4A4A);
}

/* 表单项 */
:deep(.el-form-item) {
  margin-bottom: 18px;
  display: flex;
  align-items: flex-start;
}
:deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--text-primary, #4A4A4A);
  min-width: 110px;
}

.unit-suffix {
  margin-left: 8px;
  font-size: 13px;
  color: var(--text-secondary, #8E8E8E);
}

/* 时间行 */
.time-row-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.time-label {
  font-size: 13px;
  color: var(--text-secondary, #8E8E8E);
  flex-shrink: 0;
}
.time-sep {
  color: #B0B0B0;
  font-size: 13px;
  flex-shrink: 0;
}

/* 逐日 */
.daily-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.daily-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 休息段 */
.rest-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.rest-select {
  padding: 6px 10px;
  border: 1px solid var(--border-color, #E8E5DF);
  border-radius: 8px;
  font-size: 13px;
  background: var(--bg-card, #fff);
  color: var(--text-primary, #4A4A4A);
  outline: none;
}

/* 通用 */
.empty-hint {
  text-align: center;
  padding: 20px;
  color: #B0B0B0;
  font-size: 13px;
}

/* 底部操作 */
.step-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}
</style>
