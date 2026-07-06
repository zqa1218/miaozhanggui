import { defineStore } from 'pinia'
import { ref } from 'vue'
import { bookingApi } from '@/api/bookingApi'

export const useBookingStore = defineStore('booking', () => {
  const availableSlots = ref([])
  const loading = ref(false)
  const lockStatus = ref('')  // '' | 'pre_lock' | 'hard_lock'
  const contactType = ref('')   // 'qq' | 'wechat' | 'phone' | 'other'
  const contactValue = ref('')

  async function fetchAvailable(studioId, date) {
    loading.value = true
    try {
      const res = await bookingApi.getAvailable(studioId, date)
      availableSlots.value = res.data.slots
    } finally {
      loading.value = false
    }
  }

  async function submitBooking(data) {
    const res = await bookingApi.create(data)
    return res.data
  }

  /** 第二重锁：管理端确认锁定 */
  async function confirmLock(orderNo) {
    const res = await bookingApi.confirmLock(orderNo)
    if (res.code === 0) lockStatus.value = 'hard_lock'
    return res
  }

  async function cancelOrder(orderId) {
    await bookingApi.cancel(orderId)
  }

  return { availableSlots, loading, lockStatus, contactType, contactValue, fetchAvailable, submitBooking, confirmLock, cancelOrder }
})
