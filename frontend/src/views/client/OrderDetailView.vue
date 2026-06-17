<template>
  <div class="order-detail-view fade-in-up">
    <div v-if="order.viewingOrder" class="section">
      <div class="order-title">{{ order.viewingOrder.studioTitle }}</div>
      <div class="order-meta">
        <p v-if="order.viewingOrder.roleName"><i class="fa-solid fa-user"></i> 角色: {{ order.viewingOrder.roleName }}</p>
        <p><i class="fa-regular fa-calendar"></i> {{ order.viewingOrder.date }}</p>
        <p><i class="fa-regular fa-clock"></i> {{ order.viewingOrder.bookingStartTime || order.viewingOrder.times?.join(',') }}
           <template v-if="order.viewingOrder.bookingEndTime"> - {{ order.viewingOrder.bookingEndTime }}</template>
        </p>
        <p v-if="order.viewingOrder.contactNote"><i class="fa-solid fa-note-sticky"></i> {{ order.viewingOrder.contactNote }}</p>
        <p v-if="order.viewingOrder.addonTotal > 0">附加项目: +¥{{ order.viewingOrder.addonTotal }} ({{ (order.viewingOrder.selectedAddonIds || []).length }} 项)</p>
        <p>总价: ¥{{ order.viewingOrder.totalPrice }} | 定金: ¥{{ order.viewingOrder.depositAmount }}</p>
      </div>
      <div class="order-status">
        <span class="tag" :class="statusTagStyle">{{ order.viewingOrder.status }}</span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="section" v-if="order.viewingOrder">
      <el-button
        v-if="order.viewingOrder.status === '待支付'"
        type="danger" plain @click="showCancel = true"
      >
        申请取消
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useOrderStore } from '@/stores/order'

const route = useRoute()
const order = useOrderStore()
const showCancel = ref(false)

const statusLabel = computed(() => {
  const m = { pending: '待确认', active: '进行中', done: '已完成' }
  return m[order.viewingOrder?.status] || order.viewingOrder?.status || ''
})

const statusTagStyle = computed(() => {
  const m = { pending: 'tag-orange', active: 'tag-blue', done: 'tag-green' }
  return m[order.viewingOrder?.status] || ''
})

const steps = computed(() => {
  const s = order.viewingOrder?.status
  return [
    { key: 1, cls: 'done', lineCls: 'done' },
    { key: 2, cls: s === 'active' ? 'current' : s === 'done' ? 'done' : '', lineCls: '' },
    { key: 3, cls: s === 'done' ? 'done' : '', lineCls: '' },
  ]
})
</script>

<style scoped>
.order-detail-view { position: relative; z-index: 1; }
.section {
  background: rgba(255,255,255,0.72); backdrop-filter: blur(12px);
  margin: 10px 14px; border-radius: 18px; padding: 16px;
  box-shadow: 0 4px 20px rgba(120,130,125,0.04);
  border: 1px solid rgba(180,185,182,0.18);
}
.order-title { font-size: 18px; font-weight: 700; }
.order-meta { margin-top: 8px; font-size: 13px; color: var(--text-secondary, #8e8ea0); line-height: 1.8; }
.order-status { margin-top: 10px; }
.tag {
  font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: 600;
}
.tag-orange { background: var(--color-disabled-bg, #f5f0e8); color: #8a7040; }
.tag-blue { background: var(--color-info-bg, #edf2f6); color: #5a7a96; }
.tag-green { background: var(--color-success-bg, #eaf0eb); color: #4a6e52; }
.tag-red { background: var(--color-danger-bg, #f5ecec); color: #a05050; }
.tag-gray { background: var(--color-disabled-bg, #f2f3f2); color: #888; }
.order-progress { display: flex; align-items: center; gap: 2px; margin-top: 12px; }
.order-progress .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border-color, #e0e0e0); }
.order-progress .dot.done { background: #7ba882; }
.order-progress .dot.current { background: #5a7a65; box-shadow: 0 0 6px rgba(125,158,138,0.4); }
.order-progress .line { flex: 1; height: 2px; background: var(--border-color, #e0e0e0); min-width: 12px; }
.order-progress .line.done { background: #7ba882; }
</style>
