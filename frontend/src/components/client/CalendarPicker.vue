<template>
  <div class="cal-wrapper">
    <div class="cal-header">
      <button class="cal-btn" @click="prevMonth"><i class="fa-solid fa-chevron-left"></i></button>
      <span>{{ year }}年{{ month }}月</span>
      <button class="cal-btn" @click="nextMonth"><i class="fa-solid fa-chevron-right"></i></button>
    </div>
    <div class="cal-weekdays">
      <span v-for="d in weekDays" :key="d">{{ d }}</span>
    </div>
    <div class="cal-days">
      <span
        v-for="(day, idx) in days"
        :key="idx"
        class="cal-day"
        :class="{
          today: day.isToday,
          selected: day.date === selectedDate,
          past: day.isPast,
          unavailable: day.isUnavailable,
          holiday: day.isHoliday,
          'has-order': bookedDates.has(day.date),
        }"
        @click="selectDay(day)"
      >
        {{ day.label }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  year: Number,
  month: Number,
  selectedDate: String,
  bookedDates: { type: Set, default: () => new Set() },
  availableDates: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:month', 'select'])

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const availableSet = computed(() => {
  if (!props.availableDates || props.availableDates.length === 0) return null
  return new Set(props.availableDates)
})

const days = computed(() => {
  const y = props.year
  const m = props.month
  const firstDay = new Date(y, m - 1, 1).getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const result = []
  // 填充上月尾部空白
  for (let i = 0; i < firstDay; i++) {
    result.push({ label: '', date: '', isPast: true })
  }
  // 本月日期
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    result.push({
      label: d,
      date: dateStr,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
      isUnavailable: availableSet.value ? !availableSet.value.has(dateStr) : false,
    })
  }
  return result
})

function prevMonth() {
  let y = props.year, m = props.month - 1
  if (m < 1) { y--; m = 12 }
  emit('update:month', y, m)
}

function nextMonth() {
  let y = props.year, m = props.month + 1
  if (m > 12) { y++; m = 1 }
  emit('update:month', y, m)
}

function selectDay(day) {
  if (!day.date || day.isPast || day.isUnavailable) return
  emit('select', day.date)
}
</script>

<style scoped>
.cal-wrapper {
  background: rgba(255,255,255,0.5);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-radius: 18px; padding: 12px;
  border: 1px solid rgba(255,255,255,0.5);
  box-shadow: 0 2px 16px rgba(120,130,125,0.05), inset 0 1px 0 rgba(255,255,255,0.5);
}
.cal-header {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 15px; font-weight: 700; margin-bottom: 10px;
  color: rgba(0,0,0,0.6);
}
.cal-btn {
  background: rgba(255,255,255,0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.4);
  padding: 7px 16px; border-radius: 20px; color: #5a7a65;
  font-weight: 700; cursor: pointer; font-size: 13px;
  transition: all 0.15s;
}
.cal-btn:hover { background: rgba(255,255,255,0.7); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.cal-weekdays {
  display: grid; grid-template-columns: repeat(7, 1fr);
  text-align: center; font-size: 11px; color: rgba(0,0,0,0.3); margin-bottom: 6px;
}
.cal-days {
  display: grid; grid-template-columns: repeat(7, 1fr);
  gap: 4px; text-align: center;
}
.cal-day {
  padding: 10px 0; font-size: 13px; border-radius: 14px;
  cursor: pointer; color: #3a3a4a; transition: all 0.15s; position: relative;
}
.cal-day:hover { background: rgba(232,240,235,0.4); }
.cal-day.today {
  font-weight: 700; color: #5a7a65;
  background: rgba(90,122,101,0.06);
}
.cal-day.selected {
  background: linear-gradient(135deg, rgba(138,171,150,0.8), rgba(155,184,166,0.8));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff; font-weight: 700;
  box-shadow: 0 4px 16px rgba(125,158,138,0.3);
  border: 1px solid rgba(255,255,255,0.3);
}
.cal-day.past { color: rgba(0,0,0,0.2); cursor: default; }
.cal-day.past:hover { background: transparent; }
.cal-day.unavailable { color: rgba(0,0,0,0.2); cursor: default; text-decoration: line-through; }
.cal-day.unavailable:hover { background: transparent; }
.cal-day.has-order::after {
  content: ''; width: 5px; height: 5px; background: rgba(201,138,138,0.5);
  border-radius: 50%; position: absolute; bottom: 3px;
  left: 50%; transform: translateX(-50%);
  box-shadow: 0 0 3px rgba(201,138,138,0.3);
}
</style>
