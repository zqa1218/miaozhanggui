<template>
  <div class="orders-view fade-in-up">
    <div class="section-box">
      <h3><i class="fa-solid fa-list-check"></i> 订单管理</h3>

      <!-- Tab 筛选 -->
      <div class="tab-nav">
        <span
          v-for="t in tabs"
          :key="t.key"
          :class="{ active: currentTab === t.key }"
          @click="currentTab = t.key"
        >{{ t.label }}</span>
      </div>

      <!-- 订单列表 -->
      <div v-if="order.loading" class="loading-wrap">加载中...</div>
      <template v-else>
        <div
          v-for="item in filteredOrders"
          :key="item.id"
          class="order-card"
          :class="'status-' + item.status"
        >
          <div class="order-top">
            <div>
              <strong>{{ item.studioTitle || '未知项目' }}</strong>
              <span v-if="item.roleName" class="role-badge">{{ item.roleName }}</span>
              <span class="order-id">#{{ item.orderNo?.slice(-8) }}</span>
            </div>
            <span class="tag" :class="statusTag(item.status)">{{ item.status }}</span>
          </div>
          <div class="order-meta">
            <span><i class="fa-regular fa-calendar"></i> {{ item.date }}</span>
            <span v-if="item.bookingStartTime">
              <i class="fa-regular fa-clock"></i> {{ item.bookingStartTime }}{{ item.bookingEndTime ? ' - ' + item.bookingEndTime : '' }}
            </span>
            <span v-else><i class="fa-regular fa-clock"></i> {{ item.times?.join(',') }}</span>
            <span v-if="item.contactNote"><i class="fa-solid fa-note-sticky"></i> {{ item.contactNote }}</span>
            <span>¥{{ item.totalPrice }}</span>
          </div>

          <div class="order-actions">
            <!-- 待支付: 无操作 -->
            <!-- 已付定金: 确认锁定 -->
            <el-button
              v-if="item.status === '已付定金'"
              size="small" type="primary"
              @click="handleConfirmLock(item.orderNo)"
            >确认接单 (硬锁定)</el-button>
            <!-- 已确认锁定: 标记结清 -->
            <el-button
              v-if="item.status === '已确认锁定'"
              size="small" type="success"
              @click="changeStatus(item.orderNo, '已结清')"
            >标记结清</el-button>
            <!-- 已结清: 归档 -->
            <el-button
              v-if="item.status === '已结清'"
              size="small" type="success"
              @click="handleArchive(item.orderNo)"
            >完成拍摄归档</el-button>
            <!-- 退款审核中: 显示中 -->
            <span v-if="item.status === '退款审核中'" class="refunding-hint">退款审核中...</span>
          </div>
        </div>
        <div v-if="!filteredOrders.length" class="empty-state">暂无订单</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useOrderStore } from '@/stores/order'
import { useAuthStore } from '@/stores/auth'
import { ElMessage, ElMessageBox } from 'element-plus'

const order = useOrderStore()
const auth = useAuthStore()
const currentTab = ref('all')

const tabs = [
  { key: 'all', label: '全部' },
  { key: '待支付', label: '待支付' },
  { key: '已付定金', label: '待确认' },
  { key: '已确认锁定', label: '已锁定' },
  { key: '尾款待确认', label: '尾款待确认' },
  { key: '已结清', label: '已结清' },
  { key: '退款审核中', label: '退款中' },
]

const statusTags = {
  '待支付': 'tag-orange', '已付定金': 'tag-orange',
  '已确认锁定': 'tag-blue', '尾款待确认': 'tag-blue',
  '已结清': 'tag-green', '已完成拍摄': 'tag-green',
  '退款审核中': 'tag-red', '已取消': 'tag-gray', '已退款取消': 'tag-gray',
}

const filteredOrders = computed(() => {
  if (currentTab.value === 'all') return order.orders
  return order.orders.filter(o => o.status === currentTab.value)
})

function statusTag(s) { return statusTags[s] || '' }

onMounted(() => order.fetchAdminOrders({ mId: auth.mId }))

async function changeStatus(orderNo, status) {
  const res = await order.changeStatus({ orderNo, status, mId: auth.mId })
  if (res.code === 0) ElMessage.success('操作成功')
  else ElMessage.error(res.message || '操作失败')
}

async function handleConfirmLock(orderNo) {
  await ElMessageBox.confirm('确认接单后将硬锁定时间段，确定？', '确认锁定', { type: 'info' })
  const res = await order.confirmLockAction({ orderNo, mId: auth.mId })
  if (res.code === 0) ElMessage.success('订单已确认锁定')
  else ElMessage.error(res.message || '操作失败')
}

async function handleArchive(orderNo) {
  await ElMessageBox.confirm('确定归档为已完成拍摄？', '归档', { type: 'info' })
  const res = await order.archive({ orderNo, type: '已完成拍摄', mId: auth.mId })
  if (res.code === 0) ElMessage.success('已归档')
  else ElMessage.error(res.message || '操作失败')
}
</script>

<style scoped>
.section-box {
  background: #fff; border-radius: 16px; padding: 20px; margin-bottom: 16px;
  border: 1px solid #F0EDE8; box-shadow: 0 2px 8px rgba(0,0,0,.03);
}
.section-box h3 { margin: 0 0 12px; font-size: 16px; display: flex; align-items: center; gap: 8px; color: #4A4A4A; }
.loading-wrap { text-align: center; padding: 40px; color: #8E8E8E; }
.tab-nav {
  display: flex; gap: 4px; margin-bottom: 14px; flex-wrap: wrap;
  background: #F4F2EE; border-radius: 16px; padding: 5px;
}
.tab-nav span {
  padding: 9px 18px; border-radius: 14px; font-size: 13px; font-weight: 600;
  cursor: pointer; color: #8E8E8E; transition: 0.2s;
}
.tab-nav span.active { background: #fff; color: #D4893E; box-shadow: 0 2px 10px rgba(244,164,96,0.12); }
.order-card { padding: 16px; margin-bottom: 12px; border-radius: 16px; border: 1px solid #F0EDE8; border-left: 5px solid #F4A460; background: #fff; }
.order-card.status-待支付 { border-left-color: #F9E0A0; }
.order-card.status-已付定金 { border-left-color: #E0CDB0; }
.order-card.status-已确认锁定 { border-left-color: #A9C1D9; }
.order-card.status-尾款待确认 { border-left-color: #A9C1D9; }
.order-card.status-已结清 { border-left-color: #A8D8B9; }
.order-card.status-退款审核中 { border-left-color: #EFA8A8; }
.order-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.role-badge { font-size: 12px; background: #FEF7EF; color: #D4893E; padding: 4px 10px; border-radius: 10px; margin-left: 6px; font-weight: 500; }
.order-id { font-size: 12px; color: #8E8E8E; margin-left: 8px; }
.order-meta { display: flex; gap: 16px; font-size: 13px; color: #8E8E8E; flex-wrap: wrap; }
.tag {
  font-size: 11px; padding: 3px 10px; border-radius: 14px; font-weight: 600;
}
.tag-orange { background: #FEFBF6; color: #B8933E; }
.tag-blue { background: #F0F4F8; color: #5A7A9A; }
.tag-green { background: #EDF6F0; color: #5A8A6A; }
.tag-red { background: #FDF2F2; color: #C87878; }
.tag-gray { background: #F4F2EE; color: #888; }
.order-actions { margin-top: 10px; display: flex; gap: 8px; align-items: center; }
.refunding-hint { font-size: 13px; color: #a05050; }
.empty-state { text-align: center; padding: 60px 0; color: #b8bdb9; }
</style>
