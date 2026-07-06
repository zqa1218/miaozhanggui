/**
 * 排期 Store
 *
 * 管理日历状态、已预订时段、不可用时段。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getBookedTimes, getUnavailableGrid, saveUnavailableSlots } from '@/api/schedule'

export const useScheduleStore = defineStore('schedule', () => {
  const bookedSlotsMap = ref({})
  const bookedDates = ref(new Set())
  const unavailableGrid = ref({})
  const loadingSlots = ref(false)

  const calYear = ref(new Date().getFullYear())
  const calMonth = ref(new Date().getMonth() + 1)
  const selectedDate = ref('')

  async function fetchBookedTimes(params) {
    loadingSlots.value = true
    try {
      const res = await getBookedTimes(params)
      if (res.data) {
        bookedSlotsMap.value = res.data.slotsMap || {}
        bookedDates.value = new Set(res.data.dates || [])
      }
    } finally {
      loadingSlots.value = false
    }
  }

  async function fetchUnavailableGrid(params) {
    const res = await getUnavailableGrid(params)
    if (res.data) unavailableGrid.value = res.data
    return res
  }

  async function saveSlots(data) {
    return saveUnavailableSlots(data)
  }

  function setMonth(year, month) {
    calYear.value = year
    calMonth.value = month
  }

  function selectDate(date) {
    selectedDate.value = date
  }

  return {
    bookedSlotsMap, bookedDates, unavailableGrid, loadingSlots,
    calYear, calMonth, selectedDate,
    fetchBookedTimes, fetchUnavailableGrid, saveSlots,
    setMonth, selectDate,
  }
})
