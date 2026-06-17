<template>
  <div class="cal-view">
    <div class="cal-wdays">
      <span v-for="d in weekDays" :key="d">{{ d }}</span>
    </div>
    <div class="cal-grid">
      <span
        v-for="(day, idx) in days"
        :key="idx"
        class="cal-cell"
        :class="{
          today: day.isToday,
          selected: day.date === selectedDate,
          past: day.isPast,
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
})

const emit = defineEmits(['select'])

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const days = computed(() => {
  const y = props.year
  const m = props.month
  const firstDay = new Date(y, m - 1, 1).getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const result = []
  for (let i = 0; i < firstDay; i++) result.push({ label: '', date: '', isPast: true })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    result.push({ label: d, date: dateStr, isToday: dateStr === todayStr, isPast: dateStr < todayStr })
  }
  return result
})

function selectDay(day) {
  if (!day.date || day.isPast) return
  emit('select', day.date)
}
</script>

<style scoped>
.cal-view { background: var(--bg-card, #fff); border-radius: 16px; padding: 12px; border: 1px solid var(--border-color, #e5e5ea); }
.cal-wdays {
  display: grid; grid-template-columns: repeat(7, 1fr);
  text-align: center; font-size: 11px; color: #8e8e93; margin-bottom: 4px;
}
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; text-align: center; }
.cal-cell {
  padding: 8px 2px; font-size: 13px; border-radius: 10px; cursor: pointer;
  transition: .15s; position: relative;
}
.cal-cell:hover { background: #eef1ee; }
.cal-cell.today { font-weight: 700; color: #5a7a65; }
.cal-cell.selected { background: #5a7a65; color: #fff; font-weight: 600; }
.cal-cell.past { color: #c8c8cc; cursor: default; }
.cal-cell.past:hover { background: transparent; }
.cal-cell.has-order::after {
  content: ''; width: 5px; height: 5px; background: #c98a8a;
  border-radius: 50%; position: absolute; bottom: 2px;
  left: 50%; transform: translateX(-50%);
}
</style>
