<script setup>
import { computed } from 'vue'

const props = defineProps({
  allTime: {
    type: Boolean,
    default: false,
  },
  dates: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:allTime', 'update:dates'])

const normalizedDates = computed(() => {
  if (!Array.isArray(props.dates)) return []
  return Array.from(
    new Set(
      props.dates
        .map(item => String(item || '').slice(0, 10))
        .filter(Boolean)
    )
  ).sort()
})

function disabledDate(time) {
  return time.getTime() < Date.now() - 8.64e7
}

function handleAllTimeChange(val) {
  emit('update:allTime', val)
  if (val) {
    emit('update:dates', [])
  }
}

function handleDatesChange(val) {
  if (!val || !Array.isArray(val)) {
    emit('update:dates', [])
    return
  }
  const clean = val.map(d => String(d).slice(0, 10)).filter(Boolean)
  emit('update:dates', Array.from(new Set(clean)).sort())
}

function removeDate(date) {
  emit(
    'update:dates',
    normalizedDates.value.filter(d => d !== date)
  )
}
</script>

<template>
  <div class="open-date-selector">
    <!-- 全时段开关 -->
    <el-form-item label="全时段">
      <div class="all-time-row">
        <el-switch
          :model-value="allTime"
          active-text="开启"
          inactive-text="关闭"
          @update:model-value="handleAllTimeChange"
        />
        <el-tooltip
          content="开启后该项目对所有日期开放接单，无需手动选择具体日期"
          placement="top"
        >
          <span class="tooltip-icon">?</span>
        </el-tooltip>
      </div>
    </el-form-item>

    <!-- 全时段开启提示 -->
    <div v-if="allTime" class="all-time-notice">
      <span class="notice-icon">&#10003;</span>
      全时段模式已开启，客户可在任意日期预约
    </div>

    <!-- 关闭时：日期多选 -->
    <el-form-item v-else label="选择可接单日期" required>
      <div class="date-picker-area">
        <el-date-picker
          :model-value="normalizedDates"
          type="dates"
          value-format="YYYY-MM-DD"
          placeholder="点击选择可接单日期"
          :disabled-date="disabledDate"
          style="width:100%"
          @update:model-value="handleDatesChange"
        />
        <div v-if="normalizedDates.length > 0" class="date-tags">
          <el-tag
            v-for="d in normalizedDates"
            :key="d"
            closable
            type="info"
            size="small"
            @close="removeDate(d)"
          >
            {{ d }}
          </el-tag>
        </div>
        <span class="field-hint">已选 {{ normalizedDates.length }} 天</span>
      </div>
    </el-form-item>
  </div>
</template>

<style scoped>
.open-date-selector {
  /* container */
}

/* 全时段行 */
.all-time-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tooltip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-disabled-bg, #F4F2EE);
  color: #B0B0B0;
  font-size: 11px;
  font-weight: 700;
  cursor: help;
}

/* 全时段开启提示 */
.all-time-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: var(--color-success-bg, #EDF6F0);
  border: 1px solid rgba(168,216,185,0.30);
  border-radius: 10px;
  color: #5A8A6A;
  font-size: 14px;
  font-weight: 500;
  margin-top: 8px;
}

.notice-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #A8D8B9;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

/* 日期选择区 */
.date-picker-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.date-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.field-hint {
  font-size: 12px;
  color: #B0B0B0;
}

@media (max-width: 768px) {
  .all-time-row {
    flex-wrap: wrap;
  }
}
</style>
