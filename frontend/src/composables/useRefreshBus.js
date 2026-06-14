/**
 * useRefreshBus — 跨组件刷新通信（provide / inject）
 *
 * 用法:
 *   父组件 (Layout):
 *     const refreshBus = useRefreshBus()
 *     provide('refreshBus', refreshBus)
 *
 *   子组件 (Page):
 *     const refreshBus = inject('refreshBus')
 *     watch(refreshBus.tick, () => { ... refetch ... })
 */

import { ref, readonly } from 'vue'

export function useRefreshBus() {
  const tick = ref(0)
  const lastRefreshed = ref(null)  // Date

  function trigger() {
    tick.value++
    lastRefreshed.value = new Date()
  }

  return {
    tick: readonly(tick),
    lastRefreshed: readonly(lastRefreshed),
    trigger,
  }
}
