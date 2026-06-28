<template>
  <div class="home-view fade-in-up">
    <!-- 加载中 -->
    <div v-if="studio.loading" class="loading-wrap">
      <i class="fa-solid fa-spinner fa-spin"></i> 加载中...
    </div>

    <!-- 项目宫格 -->
    <template v-else>
      <div v-if="studio.list.length" class="glass-grid">
        <div
          v-for="item in studio.list"
          :key="item.id"
          class="glass-card"
          @click="goDetail(item.id)"
        >
          <!-- 封面图 -->
          <div class="card-cover">
            <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" />
            <div v-else class="cover-placeholder">
              <i class="fa-solid fa-image"></i>
            </div>
            <!-- 类型角标 -->
            <span v-if="item.isStyleEnabled" class="cover-badge cover-badge-style">多样式</span>
            <span v-else class="cover-badge cover-badge-single">单张计费</span>
          </div>

          <!-- 信息区 -->
          <div class="card-body">
            <h3 class="card-title">{{ item.title }}</h3>
            <p v-if="item.description" class="card-desc">{{ item.description }}</p>

            <!-- 日期 & 时间 -->
            <div class="card-row" v-if="item.baseStartTime">
              <i class="fa-regular fa-clock row-icon"></i>
              <span>{{ item.baseStartTime }} — {{ item.baseEndTime }}</span>
            </div>
            <div class="card-row" v-if="item.city">
              <i class="fa-solid fa-location-dot row-icon"></i>
              <span>{{ item.city }}</span>
            </div>

            <!-- 标签行 -->
            <div class="card-tags">
              <span class="tag-item tag-price">
                <i class="fa-solid fa-yen-sign"></i>
                {{ item.isStyleEnabled ? '多样式可选' : '¥' + (item.singlePrice || 0) + '/张' }}
              </span>
              <span class="tag-item tag-duration" v-if="item.duration">
                <i class="fa-regular fa-clock"></i> {{ item.duration }}分钟
              </span>
              <span class="tag-item tag-deposit">
                定金{{ item.depositRatio || 30 }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <i class="fa-solid fa-inbox"></i>
        <p>暂无可用项目</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStudioStore } from '@/stores/studio'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const studio = useStudioStore()
const settings = useSettingsStore()

onMounted(() => {
  studio.fetchLiteList()
  settings.fetch()
})

function goDetail(id) {
  router.push({ name: 'StudioDetail', params: { id } })
}
</script>

<style scoped>
.home-view {
  position: relative; z-index: 1;
  padding: 16px 16px 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.loading-wrap {
  text-align: center; padding: 80px 0;
  color: #8e8e93; font-size: 14px;
}

/* ═══════════════════════════════════════════
   CSS Grid 宫格容器
   ═══════════════════════════════════════════ */
.glass-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 28px;
}

@media (max-width: 1100px) {
  .glass-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .glass-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; }
}
@media (max-width: 480px) {
  .glass-grid { grid-template-columns: 1fr; }
}

/* ═══════════════════════════════════════════
   日系白卡
   ═══════════════════════════════════════════ */
.glass-card {
  background: #FFFFFF;
  border-radius: 24px;
  overflow: hidden;
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,.03);
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s cubic-bezier(0.25,0.8,0.25,1);
  display: flex;
  flex-direction: column;
}
.glass-card:hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 12px 36px rgba(0,0,0,.07);
}
.glass-card:active {
  transform: scale(0.98);
}

/* ═══════════════════════════════════════════
   封面图区域
   ═══════════════════════════════════════════ */
.card-cover {
  position: relative;
  width: 100%;
  padding-top: 75%;
  overflow: hidden;
  background: linear-gradient(135deg, #FEFBF6, #F0F4F8, #EDF6F0);
}
.card-cover img {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
}
.cover-placeholder {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 42px; color: #b8c5bb;
}

/* 角标 */
.cover-badge {
  position: absolute;
  top: 10px; right: 10px;
  font-size: 10px; font-weight: 700;
  padding: 3px 10px; border-radius: 20px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  letter-spacing: 0.3px;
  z-index: 2;
}
.cover-badge-style {
  background: rgba(244,164,96,0.65);
  color: #fff;
}
.cover-badge-single {
  background: rgba(168,216,185,0.65);
  color: #fff;
}

/* ═══════════════════════════════════════════
   卡片信息区
   ═══════════════════════════════════════════ */
.card-body {
  padding: 20px 20px 24px;
  display: flex; flex-direction: column;
  gap: 8px;
  flex: 1;
}

.card-title {
  font-size: 16px; font-weight: 700;
  color: #4A4A4A;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-desc {
  font-size: 13px; color: #8E8E8E;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 2px;
}

/* 信息行 */
.card-row {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: #8E8E8E;
}
.row-icon {
  font-size: 12px; color: #D4893E;
  width: 14px; text-align: center;
}

/* ═══════════════════════════════════════════
   标签行 — 莫兰迪色
   ═══════════════════════════════════════════ */
.card-tags {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: auto; padding-top: 12px;
}
.tag-item {
  font-size: 11px; font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  display: inline-flex; align-items: center; gap: 4px;
  letter-spacing: 0.3px;
}
.tag-price {
  background: rgba(244,164,96,0.12);
  color: #D4893E;
}
.tag-duration {
  background: rgba(169,193,217,0.14);
  color: #5A7A9A;
}
.tag-deposit {
  background: rgba(249,224,160,0.18);
  color: #B8933E;
}

/* ═══════════════════════════════════════════
   空态
   ═══════════════════════════════════════════ */
.empty-state {
  text-align: center; padding: 100px 0; color: #B0B0B0;
}
.empty-state i { font-size: 48px; margin-bottom: 12px; display: block; }
</style>
