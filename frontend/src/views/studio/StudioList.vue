<script setup>
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { LocationInformation, Clock } from '@element-plus/icons-vue'
import { useStudioStore } from '@/stores/studio'
import { storage, getQueryParam } from '@/utils/storage'
import AppIllustration from '@/components/shared/AppIllustration.vue'
import placeholder4x3 from '@/assets/images/placeholder-4x3.svg'

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
      <AppIllustration name="empty-no-projects" :width="160" />
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
          <img v-else :src="placeholder4x3" alt="" class="cover-img" />
          <span v-if="studio.isStyleEnabled" class="cover-tag cover-tag-style">多样式</span>
        </div>

        <!-- 信息区 -->
        <div class="card-body">
          <h3 class="card-title">{{ studio.title }}</h3>
          <p v-if="studio.description" class="card-desc">{{ studio.description }}</p>

          <div class="card-meta">
            <span v-if="studio.city" class="meta-item">
              <el-icon><LocationInformation /></el-icon> {{ studio.city }}
            </span>
            <span v-if="studio.baseStartTime" class="meta-item">
              <el-icon><Clock /></el-icon> {{ studio.baseStartTime }}—{{ studio.baseEndTime }}
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
.studio-list { padding: 0 0 var(--space-8); max-width: var(--w-wide); margin: 0 auto; }

.top-bar {
  display: flex; align-items: center; gap: var(--space-4);
  margin-bottom: var(--space-6);
}
.page-title { font-size: 22px; flex: 1; color: var(--text-1); font-weight: 700; }
.btn-back {
  flex-shrink: 0;
  height: 34px; padding: 0 18px;
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-btn);
  font-family: inherit; font-size: 13px;
  cursor: pointer; color: var(--text-1); font-weight: 600;
  transition: background-color var(--duration-1) var(--ease-out),
              border-color var(--duration-1) var(--ease-out);
}
.btn-back:hover { background: var(--color-primary-tint); border-color: var(--color-primary); }
.btn-add {
  flex-shrink: 0;
  height: 38px; padding: 0 22px;
  background: var(--color-primary-gradient);
  color: var(--text-on-primary);
  border: none; border-radius: var(--radius-btn);
  font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
  box-shadow: var(--shadow-primary);
  transition: box-shadow var(--duration-2) var(--ease-out),
              transform var(--duration-1) var(--ease-out);
}
.btn-add:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(var(--color-primary-rgb), .30); }

/* ═══════════════════════════════════════════
   宫格
   左右内边距交由外层 .client-main / .content-wrap 提供，
   这里再补一层会形成双重留白。
   ═══════════════════════════════════════════ */
.studio-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-5);
}
@media (max-width: 768px) {
  .studio-grid { grid-template-columns: 1fr; gap: var(--space-4); }
}

.empty-state { text-align: center; padding: 56px 20px; color: var(--text-3); }
.empty-icon {
  display: block; margin: 0 auto var(--space-3);
  font-size: 40px; color: var(--color-primary-dark);
}

/* ═══════════════════════════════════════════
   卡片（C 端浏览 / B 端管理共用）
   不加 backdrop-filter：宫格里有 20+ 张卡，逐个离屏模糊会掉帧。
   ═══════════════════════════════════════════ */
.glass-card, .card-admin {
  background: var(--surface-1);
  border: 1px solid var(--glass-hairline);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--shadow-1);
  display: flex; flex-direction: column;
  transition: transform var(--duration-2) var(--ease-out),
              box-shadow var(--duration-2) var(--ease-out);
}
.glass-card { cursor: pointer; }
.glass-card:hover, .card-admin:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-3);
}
.glass-card:active { transform: scale(.99); }

/* ═══════════════════════════════════════════
   封面图
   ═══════════════════════════════════════════ */
.card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: linear-gradient(135deg, var(--color-primary-tint), var(--color-sky-light), var(--color-mint-light));
}
.cover-img {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform var(--duration-3) var(--ease-out);
}
.glass-card:hover .cover-img { transform: scale(1.04); }
.cover-ph {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 40px; color: var(--color-primary-dark);
}
.cover-tag {
  position: absolute; top: 10px; right: 10px;
  font-size: 11px; font-weight: 700;
  padding: 3px 10px; border-radius: var(--radius-pill);
  z-index: 2;
}
.cover-tag-style {
  background: var(--color-primary);
  color: var(--text-on-primary);
}

/* ═══════════════════════════════════════════
   信息区
   ═══════════════════════════════════════════ */
.card-body {
  padding: var(--space-4) var(--space-4) var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-2);
  flex: 1;
}
.card-title {
  font-size: 16px; font-weight: 700;
  color: var(--text-1); line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-desc {
  font-size: 13px; color: var(--text-3); line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-meta {
  display: flex; flex-wrap: wrap; gap: var(--space-2);
  font-size: 12px; color: var(--text-3);
}
.meta-item { display: inline-flex; align-items: center; gap: 4px; }

/* chips */
.card-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: auto; padding-top: var(--space-2);
}
.chip {
  font-size: 11px; padding: 3px 10px; border-radius: var(--radius-pill);
  font-weight: 600; white-space: nowrap;
}
.chip-price   { background: var(--color-primary-tint); color: var(--color-primary-ink); }
.chip-pkg     { background: var(--color-info-tint);    color: var(--color-info-ink); }
.chip-deposit { color: var(--text-3); }

/* ═══════════════════════════════════════════
   底部按钮
   ═══════════════════════════════════════════ */
.card-footer { padding: var(--space-2) var(--space-4) var(--space-4); display: flex; gap: var(--space-2); }
.btn-go {
  width: 100%; height: 38px;
  background: var(--color-primary-gradient);
  color: var(--text-on-primary); border: none;
  border-radius: var(--radius-btn);
  font-family: inherit; font-size: 14px; font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-primary);
  transition: box-shadow var(--duration-2) var(--ease-out),
              transform var(--duration-1) var(--ease-out);
}
.btn-go:hover { box-shadow: 0 6px 18px rgba(var(--color-primary-rgb), .30); transform: translateY(-1px); }
.btn-edit {
  flex: 1; height: 34px;
  background: var(--color-primary-tint);
  color: var(--color-primary-ink);
  border: 1px solid var(--color-primary-line);
  border-radius: var(--radius-btn);
  font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background-color var(--duration-1) var(--ease-out);
}
.btn-edit:hover { background: var(--color-primary-soft); }
.btn-del {
  flex: 1; height: 34px;
  background: var(--color-danger-tint);
  color: var(--color-danger-ink);
  border: 1px solid rgba(239,168,168,.32);
  border-radius: var(--radius-btn);
  font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background-color var(--duration-1) var(--ease-out);
}
.btn-del:hover { background: #FBE8E8; }
</style>
