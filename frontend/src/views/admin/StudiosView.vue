<template>
  <div class="studios-view fade-in-up">
    <div class="section-box">
      <div class="section-header">
        <h3><i class="fa-solid fa-folder-open"></i> 项目管理</h3>
        <el-button type="primary" size="small" @click="goCreate">新增项目</el-button>
      </div>

      <div v-if="studio.loading" class="loading-wrap">加载中...</div>

      <template v-else>
        <div v-if="studio.studios.length" class="studio-grid">
          <div v-for="item in studio.studios" :key="item.id" class="studio-card">
            <!-- 封面图 -->
            <div class="card-cover">
              <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" />
              <div v-else class="cover-ph">
                <i class="fa-solid fa-image"></i>
              </div>
            </div>

            <!-- 信息区 -->
            <div class="card-body">
              <h4 class="card-title">{{ item.title }}</h4>
              <p v-if="item.description" class="card-desc">{{ item.description }}</p>

              <div class="card-meta">
                <span v-if="item.city"><i class="fa-solid fa-location-dot"></i> {{ item.city }}</span>
                <span v-if="item.baseStartTime">
                  <i class="fa-regular fa-clock"></i> {{ item.baseStartTime }} ~ {{ item.baseEndTime }}
                </span>
              </div>

              <div class="card-chips">
                <span v-if="item.isStyleEnabled" class="chip chip-style">
                  <i class="fa-solid fa-palette"></i> {{ item.styles?.length || 0 }}个样式
                </span>
                <span v-else class="chip chip-price">¥{{ item.singlePrice || 0 }}/张</span>
              </div>
            </div>

            <!-- 操作 -->
            <div class="card-actions">
              <el-button size="small" @click="goEdit(item.id)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDelete(item.id)">删除</el-button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">暂无项目，点击右上角新增</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStudioStore } from '@/stores/studio'
import { ElMessageBox } from 'element-plus'

const router = useRouter()
const studio = useStudioStore()

onMounted(() => studio.fetchFullList())

function goCreate() {
  router.push({ name: 'AdminStudioCreate' })
}

function goEdit(id) {
  router.push({ name: 'AdminStudioEdit', params: { id } })
}

async function handleDelete(id) {
  await ElMessageBox.confirm('确定删除该项目？', '提示', { type: 'warning' })
  await studio.remove(id)
}
</script>

<style scoped>
.studios-view { max-width: 1200px; margin: 0 auto; }
.section-box {
  background: rgba(255,255,255,0.56);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 20px; padding: 20px;
  border: 1px solid rgba(180,185,182,0.18);
  box-shadow: 0 4px 24px rgba(120,130,125,0.05);
}
.section-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 18px;
}
.section-header h3 {
  font-size: 16px; display: flex; align-items: center; gap: 6px;
  color: #3a3a3f;
}

/* ═══════════════════════════════════════════
   CSS Grid 宫格
   ═══════════════════════════════════════════ */
.studio-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
@media (max-width: 1100px) { .studio-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 768px)  { .studio-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; } }
@media (max-width: 480px)  { .studio-grid { grid-template-columns: 1fr; } }

/* ═══════════════════════════════════════════
   卡片
   ═══════════════════════════════════════════ */
.studio-card {
  background: #fff;
  border-radius: 20px; overflow: hidden;
  border: 1px solid #F0EDE8;
  box-shadow: 0 2px 8px rgba(0,0,0,.03);
  display: flex; flex-direction: column;
  transition: box-shadow 0.2s, transform 0.2s;
}
.studio-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,.06); transform: translateY(-2px); }

/* 封面 */
.card-cover {
  position: relative; width: 100%; padding-top: 65%;
  overflow: hidden;
  background: linear-gradient(135deg, #FEFBF6, #F0F4F8);
}
.card-cover img {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
}
.cover-ph {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 36px; color: #b8c5bb;
}

/* 信息区 */
.card-body {
  padding: 14px 16px; flex: 1;
  display: flex; flex-direction: column; gap: 6px;
}
.card-title {
  font-size: 15px; font-weight: 700; color: #3a3a3f;
  line-height: 1.3;
}
.card-desc {
  font-size: 12px; color: #8e8e93; line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-meta {
  display: flex; flex-wrap: wrap; gap: 10px;
  font-size: 11px; color: #8e8e93;
}
.card-meta i { color: #b0b5b2; }

.card-chips {
  display: flex; flex-wrap: wrap; gap: 5px;
  margin-top: auto; padding-top: 6px;
}
.chip {
  font-size: 10px; padding: 2px 8px; border-radius: 20px;
  font-weight: 600;
}
.chip-style { background: rgba(138,158,201,0.12); color: #5a7a96; }
.chip-price { background: rgba(125,158,138,0.12); color: #5a7a65; }

/* 底部操作 */
.card-actions {
  padding: 10px 16px 14px;
  display: flex; gap: 8px;
}
.card-actions .el-button { flex: 1; }

.loading-wrap, .empty-state { text-align: center; padding: 40px; color: #8e8e93; }
</style>
