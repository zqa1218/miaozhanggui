<script setup>
import { onMounted, ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStudioStore } from '@/stores/studio'
import { storage, getQueryParam } from '@/utils/storage'
import { Rank } from '@element-plus/icons-vue'
import { studioApi } from '@/api/studioApi'
import { ElMessage } from 'element-plus'
import SortableStudioList from '@/components/admin/SortableStudioList.vue'

const router = useRouter()
const route = useRoute()
const store = useStudioStore()
const isAdmin = ref(route.path.startsWith('/admin'))
const mId = ref('')

// ── 排序模式：构建排序列表（父组件显式传入子组件）──
const sortModeList = ref([])

function enterSortMode() {
  // 兼容 is_deleted 字段缺失：如果对象上没有 is_deleted，视为未删除
  const rawList = store.list.length > 0
    ? store.list.slice()
    : []
  const filtered = rawList.filter(s => {
    if ('is_deleted' in s) return !s.is_deleted
    if ('deleted' in s) return !s.deleted
    if ('status' in s && s.status === 'deleted') return false
    return true
  })
  filtered.sort((a, b) => {
    const aOrder = a.sort_order || 0
    const bOrder = b.sort_order || 0
    if (aOrder === 0 && bOrder === 0) return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    if (aOrder === 0) return 1
    if (bOrder === 0) return -1
    return aOrder - bOrder
  })
  // 先填充数据再切模式，保证组件挂载时 list 非空
  sortModeList.value = filtered.map(item => ({ ...item }))
  // 用 nextTick 确保 sortModeList 已更新后再切换
  nextTick(() => {
    store.toggleSortMode()
    nextTick(() => {
      sortModeList.value = filtered.map(item => ({ ...item }))
    })
  })
}

function exitSortMode() {
  store.cancelSort()
  sortModeList.value = []
}

// 拖拽后回调：子组件通知新顺序
function onSortListUpdate(newList) {
  sortModeList.value = newList ? newList.slice() : []
}

onMounted(async () => {
  mId.value = getQueryParam('mId')
    || route.query.mId
    || storage.get('mzg_client_mid', '')
    || (isAdmin.value ? storage.get('mzg_admin_mid', '') : '')
  if (mId.value) {
    storage.set('mzg_client_mid', mId.value)
    if (isAdmin.value) {
      store.fetchFullList()
    } else {
      store.fetchLiteList({ mId: mId.value })
    }
  } else if (!isAdmin.value) {
    try {
      const res = await fetch('/api/merchants-public').then(r => r.json())
      const merchants = (res.data || res) || []
      if (merchants.length > 0) {
        mId.value = merchants[0].m_id
        storage.set('mzg_client_mid', mId.value)
        store.fetchLiteList({ mId: mId.value })
      }
    } catch {}
  }
})

function goCreate() { router.push('/admin/studio/create/step1') }
function goEdit(id) { router.push(`/admin/studio/edit/${id}`) }

async function doDelete(studio) {
  if (!confirm(`确定删除项目「${studio.title}」？`)) return
  try {
    await studioApi.remove(studio.id)
    ElMessage.success('项目已下架')
    store.fetchList({ mId: mId.value })
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

function goDetail(id) { router.push('/studios/' + id + '?mId=' + mId.value) }
</script>

<template>
  <div class="studio-list">
    <!-- 顶部栏 -->
    <div class="top-bar">
      <button v-if="isAdmin" class="btn-back" @click="router.push('/admin/orders')">← 返回后台</button>
      <h1 class="page-title">{{ isAdmin ? '项目管理' : '可选项目' }}</h1>
      <button v-if="isAdmin" class="btn-add" @click="goCreate">+ 上架新项目</button>

      <!-- 排序开关 — B端专属 -->
      <div
        v-if="isAdmin"
        class="sort-toggle"
        :class="{ 'is-active': store.isSortMode }"
        @click="store.isSortMode ? exitSortMode() : enterSortMode()"
        :title="store.list.length === 0 ? '暂无项目可排序' : '拖拽调整项目展示顺序'"
      >
        <el-icon :size="18" class="sort-icon"><Rank /></el-icon>
        <span class="sort-label">排序</span>
        <el-switch
          :model-value="store.isSortMode"
          :disabled="store.list.length === 0"
          size="small"
          class="sort-switch"
        />
      </div>
    </div>

    <!-- ===== 排序模式（父组件显式传入列表数据）===== -->
    <Transition name="mode-fade">
      <SortableStudioList
        v-if="isAdmin && store.isSortMode"
        :list="sortModeList"
        :key="'sort-' + sortModeList.length"
        @cancel="exitSortMode"
        @update:list="onSortListUpdate"
      />
    </Transition>

    <!-- 加载中 -->
    <div v-if="store.loading" class="empty-state">加载中...</div>

    <!-- 空列表 -->
    <div v-else-if="!store.list.length && !store.isSortMode" class="empty-state">
      <div class="empty-icon">📦</div>
      <p>{{ isAdmin ? '暂无项目，请点击上方按钮创建' : '暂无可选项目，请稍后再来～' }}</p>
    </div>

    <!-- ===== 正常模式（宫格卡片） ===== -->
    <div v-else-if="!store.isSortMode" class="studio-grid fade-in-up">
      <div
        v-for="studio in store.list"
        :key="studio.id"
        :class="isAdmin ? 'card-admin' : 'glass-card'"
        @click="!isAdmin && goDetail(studio.id)"
      >
        <!-- 封面图 -->
        <div class="card-cover">
          <img v-if="studio.coverUrl" :src="studio.coverUrl" :alt="studio.title" class="cover-img" />
          <div v-else class="cover-ph">
            <i class="fa-solid fa-image"></i>
          </div>
          <span v-if="studio.isStyleEnabled" class="cover-tag cover-tag-style">多样式</span>
        </div>

        <!-- 信息区 -->
        <div class="card-body">
          <h3 class="card-title">{{ studio.title }}</h3>
          <p v-if="studio.description" class="card-desc">{{ studio.description }}</p>

          <div class="card-meta">
            <span v-if="studio.city" class="meta-item">
              <i class="fa-solid fa-location-dot"></i> {{ studio.city }}
            </span>
            <span v-if="studio.baseStartTime" class="meta-item">
              <i class="fa-regular fa-clock"></i> {{ studio.baseStartTime }}—{{ studio.baseEndTime }}
            </span>
          </div>

          <div class="card-chips">
            <span v-if="studio.singlePrice" class="chip chip-price">¥{{ studio.singlePrice }}/张</span>
            <span v-if="studio.packagePrice" class="chip chip-pkg">套餐 ¥{{ studio.packagePrice }}</span>
            <span class="chip chip-deposit">定金{{ studio.depositRatio || 30 }}%</span>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="card-footer">
          <template v-if="isAdmin">
            <button class="btn-edit" @click.stop="goEdit(studio.id)">编辑</button>
            <button class="btn-del" @click.stop="doDelete(studio)">删除</button>
          </template>
          <button v-else class="btn-go" @click.stop="goDetail(studio.id)">查看详情</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.studio-list { padding: 0 0 40px; max-width: 1280px; margin: 0 auto; }
.top-bar {
  display: flex; align-items: center; gap: 16px;
  padding: 0 24px; margin-bottom: 28px;
  flex-wrap: wrap;
}
.page-title { font-size: 22px; flex: 1; color: var(--text-primary, #4A4A4A); }
.btn-back {
  flex-shrink: 0; background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-color, #E8E5DF);
  padding: 8px 18px; border-radius: 28px; font-size: 13px;
  cursor: pointer; color: var(--text-primary, #4A4A4A); font-weight: 600;
  transition: all 0.2s ease;
}
.btn-back:hover { background: var(--color-peach-light, #FEF7EF); border-color: var(--color-primary, #F4A460); }
.btn-add {
  flex-shrink: 0;
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  color: #fff; border: none; padding: 10px 24px;
  border-radius: 28px; font-size: 14px; font-weight: 700; cursor: pointer;
  box-shadow: 0 4px 16px rgba(244,164,96,0.22);
  transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
}
.btn-add:hover { transform: translateY(-2px) scale(1.03);
  box-shadow: 0 8px 24px rgba(244,164,96,0.30); }

/* ═══════════════════════════════════════════
   CSS Grid 宫格
   ═══════════════════════════════════════════ */
.studio-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  padding: 0 24px;
}
@media (max-width: 768px) {
  .studio-grid { grid-template-columns: 1fr; gap: 16px; }
}

.empty-state { text-align: center; padding: 60px 20px; color: var(--text-sub, #8b8d91); }
.empty-icon { font-size: 40px; opacity: .2; margin-bottom: 10px; }

/* ═══════════════════════════════════════════
   C端白卡
   ═══════════════════════════════════════════ */
.glass-card {
  background: var(--bg-card, #FFFFFF);
  border-radius: 24px; overflow: hidden;
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,.03);
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s cubic-bezier(0.25,0.8,0.25,1);
  display: flex; flex-direction: column;
}
.glass-card:hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 12px 36px rgba(0,0,0,.07);
}
.glass-card:active { transform: scale(0.98); }

.card-admin {
  background: var(--bg-card, #FFFFFF);
  border-radius: 24px; overflow: hidden;
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,.03);
  display: flex; flex-direction: column;
  transition: box-shadow 0.3s, transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
}
.card-admin:hover {
  box-shadow: 0 12px 36px rgba(0,0,0,.07);
  transform: translateY(-4px) scale(1.01);
}

.card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: linear-gradient(135deg, #FEFBF6, #F0F4F8, #EDF6F0);
  border-radius: 16px 16px 0 0;
}
.cover-img {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform 0.5s cubic-bezier(0.25,0.8,0.25,1);
}
.glass-card:hover .cover-img { transform: scale(1.08); }
.cover-ph {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 42px; color: #F7C57C;
}
.cover-tag {
  position: absolute; top: 12px; right: 12px;
  font-size: 10px; font-weight: 700;
  padding: 4px 12px; border-radius: 20px;
  z-index: 2;
}
.cover-tag-style { background: rgba(244,164,96,0.65); color: #fff; }

.card-body {
  padding: 20px 20px 24px;
  display: flex; flex-direction: column; gap: 8px;
  flex: 1;
}
.card-title {
  font-size: 16px; font-weight: 700;
  color: var(--text-primary, #4A4A4A); line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-desc {
  font-size: 13px; color: var(--text-sub, #8E8E8E); line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--text-sub, #8b8d91); }
.meta-item { display: inline-flex; align-items: center; gap: 4px; }

.card-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; padding-top: 8px; }
.chip { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 600; white-space: nowrap; }
.chip-price { background: rgba(244,164,96,0.12); color: #D4893E; }
.chip-pkg   { background: rgba(169,193,217,0.14); color: #5A7A9A; }
.chip-deposit { color: var(--text-sub, #8E8E8E); }

.card-footer { padding: 10px 16px 14px; display: flex; gap: 8px; }
.btn-go {
  width: 100%;
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  color: #fff; border: none; padding: 12px 0;
  border-radius: 28px; font-size: 14px; font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(244,164,96,0.22);
  transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
}
.btn-go:hover { box-shadow: 0 8px 24px rgba(244,164,96,0.30); transform: translateY(-1px); }
.btn-edit {
  flex: 1;
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  color: #fff; border: none; padding: 10px 0;
  border-radius: 28px; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all 0.2s ease;
}
.btn-del {
  flex: 1;
  background: var(--bg-card, #FFFFFF);
  color: #EFA8A8;
  border: 1px solid rgba(239,168,168,0.25);
  padding: 10px 0; border-radius: 28px;
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all 0.2s ease;
}
.btn-del:hover { background: #FDF2F2; }

/* ═══════════════════════════════════════════
   排序开关
   ═══════════════════════════════════════════ */
.sort-toggle {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 16px;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 50px;
  cursor: pointer;
  user-select: none;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}
.sort-toggle:hover {
  background: rgba(255,255,255,0.2);
  border-color: rgba(255,255,255,0.35);
}
.sort-toggle.is-active {
  background: rgba(99,102,241,0.1);
  border-color: rgba(99,102,241,0.35);
  box-shadow: 0 0 16px rgba(99,102,241,0.15);
}
.sort-toggle .sort-icon { transition: transform 0.4s ease; color: #6366f1; }
.sort-toggle.is-active .sort-icon { transform: rotate(180deg); }
.sort-toggle .sort-label { font-size: 13px; font-weight: 600; color: var(--text-primary, #4A4A4A); }
.sort-switch { pointer-events: none; }

/* 模式过渡 */
.mode-fade-enter-active,
.mode-fade-leave-active { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.mode-fade-enter-from { opacity: 0; transform: translateY(16px) scale(0.97); }
.mode-fade-leave-to { opacity: 0; transform: translateY(-16px) scale(0.97); }
</style>
