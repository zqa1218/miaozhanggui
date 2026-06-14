<template>
  <div class="schedule-view fade-in-up">
    <div class="section-box">
      <h3><i class="fa-solid fa-calendar-days"></i> 排期管理</h3>

      <!-- 日历导航 -->
      <div class="cal-nav">
        <button @click="prevMonth"><i class="fa-solid fa-chevron-left"></i></button>
        <span>{{ schedule.calYear }}年{{ schedule.calMonth }}月</span>
        <button @click="nextMonth"><i class="fa-solid fa-chevron-right"></i></button>
      </div>

      <!-- 日历网格 -->
      <CalendarGrid
        :year="schedule.calYear"
        :month="schedule.calMonth"
        :selected-date="schedule.selectedDate"
        :booked-dates="schedule.bookedDates"
        @select="schedule.selectDate"
      />

      <!-- 选中日期的时段管理 -->
      <div v-if="schedule.selectedDate" class="time-section">
        <h4>{{ schedule.selectedDate }} 不可用时段</h4>
        <div class="time-grid-admin">
          <span
            v-for="slot in allTimeSlots"
            :key="slot"
            class="time-chip-admin"
            :class="{ disabled: disabledSlots.includes(slot) }"
            @click="toggleSlot(slot)"
          >{{ slot }}</span>
        </div>
        <el-button type="primary" size="small" :loading="saving" @click="saveSlots" style="margin-top:10px;">
          保存
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import CalendarGrid from '@/components/admin/CalendarGrid.vue'
import { ElMessage } from 'element-plus'

const schedule = useScheduleStore()
const disabledSlots = ref([])
const saving = ref(false)

const allTimeSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']

onMounted(() => {
  schedule.fetchBookedTimes({})
})

function prevMonth() {
  let y = schedule.calYear, m = schedule.calMonth - 1
  if (m < 1) { y--; m = 12 }
  schedule.setMonth(y, m)
}

function nextMonth() {
  let y = schedule.calYear, m = schedule.calMonth + 1
  if (m > 12) { y++; m = 1 }
  schedule.setMonth(y, m)
}

function toggleSlot(slot) {
  const idx = disabledSlots.value.indexOf(slot)
  if (idx > -1) disabledSlots.value.splice(idx, 1)
  else disabledSlots.value.push(slot)
}

async function saveSlots() {
  saving.value = true
  try {
    const res = await schedule.saveSlots({
      date: schedule.selectedDate,
      slots: disabledSlots.value,
    })
    if (res.code === 0) ElMessage.success('已保存')
    else ElMessage.error(res.message || '保存失败')
  } catch { ElMessage.error('网络错误') }
  saving.value = false
}
</script>

<style scoped>
.section-box {
  background: #fff; border-radius: 16px; padding: 20px;
  border: 1px solid #F0EDE8; box-shadow: 0 2px 8px rgba(0,0,0,.03);
}
.section-box h3 { margin: 0 0 12px; font-size: 16px; display: flex; align-items: center; gap: 8px; }
.cal-nav {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px; font-weight: 700;
}
.cal-nav button {
  background: #F4F2EE; border: none; padding: 6px 14px;
  border-radius: 20px; cursor: pointer; font-size: 13px;
  color: #D4893E; font-weight: 600; transition: 0.2s;
}
.cal-nav button:hover { background: #FEF7EF; }
.time-section { margin-top: 16px; border-top: 2px dashed #F0EDE8; padding-top: 16px; }
.time-section h4 { margin-bottom: 8px; font-size: 14px; }
.time-grid-admin { display: flex; flex-wrap: wrap; gap: 8px; }
.time-chip-admin {
  padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
  border: 1.5px solid #E8E5DF; cursor: pointer; transition: all 0.2s;
  background: #fff; color: #4A4A4A;
}
.time-chip-admin.disabled {
  background: #f5ecec; border-color: #dbb8b8; color: #a05050; font-weight: 600;
}
.time-chip-admin:not(.disabled):hover {
  background: #e8f0eb; border-color: #a0b8a8; transform: translateY(-1px);
}
</style>
