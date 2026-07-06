<script setup>
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStudioStore } from '@/stores/studio'
import { storage, getQueryParam } from '@/utils/storage'

const router = useRouter()
const route = useRoute()
const store = useStudioStore()
const isAdmin = ref(route.path.startsWith('/admin'))
const mId = ref('')

onMounted(async () => {
  // mId 仅从 URL 查询参数获取，不再回退到 localStorage（避免粘性绑定到一个商家）
  mId.value = getQueryParam('mId')
    || route.query.mId
    || ''

  if (isAdmin.value) {
    // B端：mId 可从 URL 或 admin 登录态获取
    mId.value = mId.value || storage.get('mzg_admin_mid', '')
    store.fetchFullList()
  } else {
    // C端：mId 可选，不传则返回全部工作室
    store.fetchLiteList(mId.value ? { mId: mId.value } : {})
  }
})

function goCreate() { router.push('/admin/studio/create/step1') }
function goEdit(id) { router.push(`/admin/studio/edit/${id}`) }
function doDelete(studio) {
  if (!confirm(`确定删除项目「${studio.title}」？`)) return
  import('@/api/studioApi').then(({ studioApi }) => {
    studioApi.remove(studio.id).then(() => { store.fetchList({ mId: mId.value }) })
  })
}
function goDetail(id) {
  const query = mId.value ? `?mId=${mId.value}` : ''
  router.push('/studios/' + id + query)
}
</script>

<template>
  <div class="studio-list">
    <!-- 顶部栏 -->
    <div class="top-bar">
      <button v-if="isAdmin" class="btn-back" @click="router.push('/admin/orders')">← 返回后台</button>
      <h1 class="page-title">{{ isAdmin ? '项目管理' : '可选项目' }}</h1>
      <button v-if="isAdmin" class="btn-add" @click="goCreate">+ 上架新项目</button>
    </div>

    <!-- 加载中 -->
    <div v-if="store.loading" class="empty-state">加载中...</div>

    <!-- 空列表 -->
    <div v-else-if="!store.list.length" class="empty-state">
      <div class="empty-icon">📦</div>
      <p>{{ isAdmin ? '暂无项目，请点击上方按钮创建' : '暂无可选项目，请稍后再来～' }}</p>
    </div>

    <!-- 宫格卡片 -->
    <div v-else class="studio-grid fade-in-up">
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
}
.page-title { font-size: 22px; flex: 1; color: var(--text-primary, #4A4A4A); }
.btn-back {
  flex-shrink: 0; background: #FFFFFF; border: 1px solid #E8E5DF;
  padding: 8px 18px; border-radius: 28px; font-size: 13px;
  cursor: pointer; color: var(--text-primary, #4A4A4A); font-weight: 600;
  transition: all 0.2s ease;
}
.btn-back:hover { background: #FEF7EF; border-color: var(--color-primary, #F4A460); }
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
  .studio-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

.empty-state { text-align: center; padding: 60px 20px; color: var(--text-sub, #8b8d91); }
.empty-icon { font-size: 40px; opacity: .2; margin-bottom: 10px; }

/* ═══════════════════════════════════════════
   C端白卡 — 封面图宫格
   ═══════════════════════════════════════════ */
.glass-card {
  background: #FFFFFF;
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

/* ═══════════════════════════════════════════
   B端管理卡片
   ═══════════════════════════════════════════ */
.card-admin {
  background: #FFFFFF;
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

/* ═══════════════════════════════════════════
   封面图
   ═══════════════════════════════════════════ */
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
.glass-card:hover .cover-img {
  transform: scale(1.08);
}
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
.cover-tag-style {
  background: rgba(244,164,96,0.65);
  color: #fff;
}

/* ═══════════════════════════════════════════
   信息区
   ═══════════════════════════════════════════ */
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
.card-meta {
  display: flex; flex-wrap: wrap; gap: 8px;
  font-size: 12px; color: var(--text-sub, #8b8d91);
}
.meta-item {
  display: inline-flex; align-items: center; gap: 4px;
}

/* chips */
.card-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: auto; padding-top: 8px;
}
.chip {
  font-size: 11px; padding: 3px 10px; border-radius: 20px;
  font-weight: 600; white-space: nowrap;
}
.chip-price { background: rgba(244,164,96,0.12); color: #D4893E; }
.chip-pkg   { background: rgba(169,193,217,0.14); color: #5A7A9A; }
.chip-deposit { color: var(--text-sub, #8E8E8E); }

/* ═══════════════════════════════════════════
   底部按钮
   ═══════════════════════════════════════════ */
.card-footer {
  padding: 10px 16px 14px;
  display: flex; gap: 8px;
}
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
  background: #FFFFFF;
  color: #EFA8A8;
  border: 1px solid rgba(239,168,168,0.25);
  padding: 10px 0; border-radius: 28px;
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all 0.2s ease;
}
.btn-del:hover { background: #FDF2F2; }
</style>
