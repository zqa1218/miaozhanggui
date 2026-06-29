<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { VueDraggable } from 'vuedraggable'
import { useMediaQuery } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { Rank, Close, Check, InfoFilled, FolderOpened, PictureFilled } from '@element-plus/icons-vue'
import { useStudioStore } from '@/stores/studio'

const props = defineProps({
  list: { type: Array, default: () => [] },
})
const emit = defineEmits(['cancel', 'update:list'])

const store = useStudioStore()
const isMobile = useMediaQuery('(max-width: 768px)')
const hasLocalChange = ref(false)

// 直接 shallowRef 或 ref 都可以
const localList = ref([])

// immediate watch + 空数组立即同步
watch(() => props.list, (newVal) => {
  if (newVal && newVal.length > 0) {
    if (!hasLocalChange.value) {
      localList.value = newVal.map(item => ({ ...item }))
    }
  } else {
    localList.value = []
  }
}, { immediate: true, deep: false })

// 额外兜底：如果组件已挂载但 prop 还没到，使用 nextTick 重试
onMounted(() => {
  if (localList.value.length === 0 && props.list && props.list.length > 0) {
    localList.value = props.list.map(item => ({ ...item }))
  }
  if (localList.value.length === 0 && store.list && store.list.length > 0) {
    // 终极兜底：prop 没传进来，直接读 store.list
    const filtered = store.list.filter(s => {
      if ('is_deleted' in s) return !s.is_deleted
      return true
    })
    localList.value = filtered.map(item => ({ ...item }))
  }
})

// ── 拖拽事件 ──
function onDragStart() {
  if (window.navigator?.vibrate) window.navigator.vibrate(10)
}

function onDragEnd() {
  if (window.navigator?.vibrate) window.navigator.vibrate(5)
}

function onChange() {
  hasLocalChange.value = true
  emit('update:list', localList.value)
}

// ── 操作按钮 ──
async function handleSave() {
  if (!hasLocalChange.value) {
    ElMessage.info('排序未变更')
    return
  }
  if (!localList.value.length) {
    ElMessage.warning('没有可保存的项目排序')
    return
  }
  try {
    const orderedList = localList.value.map((item, index) => ({
      id: item.id,
      sort_order: (index + 1) * 1000,
    }))
    await store.saveOrderWithList(orderedList)
  } catch {
    ElMessage.error('排序保存失败')
  }
}

function handleCancel() {
  if (hasLocalChange.value) {
    ElMessage.warning('已放弃排序修改')
  }
  store.cancelSort()
  emit('cancel')
}

const countLabel = computed(() => `${localList.value.length} 个项目`)
const showEmpty = computed(() => localList.value.length === 0)
</script>

<template>
  <div class="sortable-page-wrapper">
    <!-- 顶部提示栏 -->
    <div class="sortable-header">
      <el-icon :size="18" color="var(--el-color-primary)"><InfoFilled /></el-icon>
      <span>拖拽左侧手柄调整顺序 · C端同步生效</span>
      <span class="sortable-count">{{ countLabel }}</span>
    </div>

    <!-- 空状态 -->
    <div v-if="showEmpty" class="sortable-empty">
      <el-icon :size="64" color="var(--el-text-color-placeholder)"><FolderOpened /></el-icon>
      <h3>暂无可排序的项目</h3>
      <p>请确认项目管理页已加载项目数据</p>
      <el-button @click="handleCancel">返回列表</el-button>
    </div>

    <!-- 拖拽列表 -->
    <VueDraggable
      v-if="!showEmpty"
      v-model="localList"
      handle=".drag-handle"
      :animation="300"
      :delay="isMobile ? 300 : 0"
      :delay-on-touch-only="true"
      :scroll="true"
      :scroll-sensitivity="100"
      ghost-class="sortable-ghost"
      chosen-class="sortable-chosen"
      drag-class="sortable-drag"
      :force-fallback="isMobile"
      @start="onDragStart"
      @end="onDragEnd"
      @change="onChange"
      item-key="id"
      class="sortable-list"
    >
      <template #item="{ element, index }">
        <div
          class="sortable-card"
          :style="{ '--stagger-delay': index * 0.04 + 's' }"
        >
          <!-- 拖拽手柄 -->
          <div class="drag-handle" @touchstart.passive="() => {}">
            <el-icon :size="22"><Rank /></el-icon>
          </div>

          <!-- 序号徽章 -->
          <div class="order-badge">{{ index + 1 }}</div>

          <!-- 封面缩略图 -->
          <div class="card-cover">
            <img
              v-if="element.coverUrl"
              :src="element.coverUrl"
              :alt="element.title"
              loading="lazy"
            />
            <div v-else class="cover-placeholder">
              <el-icon :size="24"><PictureFilled /></el-icon>
            </div>
          </div>

          <!-- 项目信息 -->
          <div class="card-info">
            <h4 class="card-title">{{ element.title }}</h4>
            <div class="card-meta">
              <span v-if="element.singlePrice" class="card-price">¥{{ element.singlePrice }}/张</span>
              <span v-if="element.packagePrice" class="card-price pkg">套餐¥{{ element.packagePrice }}</span>
            </div>
          </div>
        </div>
      </template>
    </VueDraggable>

    <!-- 底部操作栏 — 始终可见 -->
    <div class="sortable-footer">
      <el-button @click="handleCancel" :disabled="store.isSavingOrder">
        <el-icon><Close /></el-icon>
        取消
      </el-button>
      <el-button
        type="primary"
        @click="handleSave"
        :loading="store.isSavingOrder"
        :disabled="!hasLocalChange && localList.length > 0"
      >
        <el-icon v-if="!store.isSavingOrder"><Check /></el-icon>
        保存排序 ({{ localList.length }})
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.sortable-page-wrapper {
  position: relative;
  min-height: 400px;
  padding: 0 24px 80px;
  max-width: 800px;
  margin: 0 auto;
}

.sortable-header {
  margin-bottom: 16px;
  padding: 10px 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 12px;
}
.sortable-header .sortable-count {
  margin-left: auto;
  font-weight: 600;
  color: var(--el-color-primary);
}

.sortable-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 24px;
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
}
.sortable-empty h3 { margin: 0; font-size: 18px; color: var(--el-text-color-regular); }
.sortable-empty p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; }

.sortable-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sortable-card {
  display: grid;
  grid-template-columns: 44px 36px 72px 1fr;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: cardEnter 0.4s ease backwards;
  animation-delay: var(--stagger-delay, 0s);
}
@keyframes cardEnter {
  from { opacity: 0; transform: translateY(20px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.drag-handle {
  display: flex; align-items: center; justify-content: center;
  min-width: 44px; min-height: 44px;
  cursor: grab; touch-action: none;
  color: var(--el-text-color-placeholder);
  border-radius: 10px; transition: color 0.2s;
}
.drag-handle:active { cursor: grabbing; color: var(--el-color-primary); }

.order-badge {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}

.card-cover {
  width: 72px; height: 72px; border-radius: 10px;
  overflow: hidden; flex-shrink: 0;
  background: linear-gradient(135deg, #FEFBF6, #F0F4F8);
}
.card-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: var(--el-text-color-placeholder);
}

.card-info { min-width: 0; }
.card-title {
  margin: 0 0 4px; font-size: 15px; font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.card-price { font-weight: 700; color: #e6a23c; font-size: 14px; }
.card-price.pkg { color: var(--el-color-primary); font-size: 12px; }

/* SortableJS 状态 */
.sortable-ghost {
  background: rgba(99,102,241,0.06) !important;
  border: 2px dashed rgba(99,102,241,0.35) !important;
  border-radius: 16px; min-height: 80px;
}
.sortable-chosen { opacity: 0.45; }
.sortable-drag {
  background: rgba(255,255,255,0.22) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  transform: scale(1.025) rotate(0.5deg);
  box-shadow: 0 20px 50px rgba(31,38,135,0.3) !important;
  z-index: 9999;
}

/* 底部操作栏 — 不依赖 hasLocalChange，始终可见 */
.sortable-footer {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 12px 20px;
  display: flex; justify-content: flex-end; gap: 12px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background: rgba(255,255,255,0.75);
  border-top: 1px solid rgba(0,0,0,0.06);
  z-index: 100;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
}

/* 移动端 */
@media (max-width: 768px) {
  .sortable-page-wrapper { padding: 0 12px 80px; }
  .sortable-card { grid-template-columns: 44px 32px 60px 1fr; gap: 8px; padding: 8px 10px; }
  .card-cover { width: 60px; height: 60px; }
  .card-title { font-size: 14px; }
}
@media (max-width: 480px) {
  .sortable-card { grid-template-columns: 44px 28px 52px 1fr; gap: 6px; padding: 8px; }
  .card-cover { width: 52px; height: 52px; }
  .card-title { font-size: 13px; }
  .sortable-footer { padding: 10px 14px; gap: 8px; }
}
</style>
