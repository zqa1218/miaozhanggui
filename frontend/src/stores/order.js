/**
 * 订单 Store
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getOrders, getMyOrders, getOrderDetail, getOrderStats,
  createOrder, createOrderV2, updateStatus, archiveOrder,
  payDeposit, payFinal, confirmLock,
  requestReschedule, requestCancel,
  confirmDeposit, confirmCompleted,
  approveReschedule, rejectReschedule,
  approveCancel, rejectCancel,
} from '@/api/order'

export const useOrderStore = defineStore('order', () => {
  const orders = ref([])
  const myOrders = ref([])
  const viewingOrder = ref(null)
  const stats = ref(null)
  const loading = ref(false)

  async function fetchAdminOrders(params) {
    loading.value = true
    try {
      const res = await getOrders(params)
      if (res.data) orders.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function fetchMyOrders(mId, deviceId) {
    loading.value = true
    try {
      const res = await getMyOrders({ mId, userDeviceId: deviceId })
      if (res.data) myOrders.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(params) {
    const res = await getOrderDetail(params)
    if (res.data) viewingOrder.value = res.data
    return res
  }

  async function fetchStats() {
    const res = await getOrderStats()
    if (res.data) stats.value = res.data
    return res
  }

  async function create(data) {
    return createOrder(data)
  }

  async function changeStatus(data) {
    const res = await updateStatus(data)
    if (res.code === 0) await fetchAdminOrders()
    return res
  }

  async function archive(data) {
    const res = await archiveOrder(data)
    if (res.code === 0) await fetchAdminOrders()
    return res
  }

  async function payDepositAction(data) {
    return payDeposit(data)
  }

  async function payFinalAction(data) {
    return payFinal(data)
  }

  async function confirmLockAction(data) {
    const res = await confirmLock(data)
    if (res.code === 0) await fetchAdminOrders()
    return res
  }

  async function requestRescheduleAction(data) {
    return requestReschedule(data)
  }

  async function requestCancelAction(data) {
    return requestCancel(data)
  }

  return {
    orders, myOrders, viewingOrder, stats, loading,
    fetchAdminOrders, fetchMyOrders, fetchDetail, fetchStats,
    create, createV2: (data) => createOrderV2(data),
    changeStatus, archive, payDepositAction, payFinalAction, confirmLockAction,
    requestRescheduleAction, requestCancelAction,
  }
})
