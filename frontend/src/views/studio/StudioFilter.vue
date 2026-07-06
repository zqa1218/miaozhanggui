<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const loading = ref(false)
const allStudios = ref([])
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const selectedCity = ref('')
const cityList = ref([])
const errorMsg = ref('')

// 本地过滤：日期由 API 负责，城市在前端过滤
const studioList = computed(() => {
  if (!selectedCity.value) return allStudios.value
  return allStudios.value.filter(s => s.city === selectedCity.value)
})

const disabledDate = (time) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return time.getTime() < today.getTime()
}

async function fetchCities() {
  try {
    const res = await fetch('/api/studios-cities').then(r => r.json())
    cityList.value = (res.data || [])
  } catch { /* 城市列表加载失败不影响主流程 */ }
}

async function fetchAvailable() {
  if (!selectedDate.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`/api/studios/available?date=${selectedDate.value}`).then(r => r.json())
    allStudios.value = (res.data || [])
  } catch {
    errorMsg.value = '网络错误，请稍后重试'
    allStudios.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchCities()
  fetchAvailable()
})

watch(selectedDate, () => {
  selectedCity.value = ''
  fetchAvailable()
})

function clearCity() {
  selectedCity.value = ''
}

function goDetail(studio) {
  router.push('/studios/' + studio.id)
}

function goBooking(studio) {
  if (!studio.mId) return
  router.push(`/booking/${studio.id}?mId=${studio.mId}`)
}
</script>

<template>
  <div class="filter-page">
    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-row">
        <label class="filter-label">📅 日期</label>
        <el-date-picker
          v-model="selectedDate"
          type="date"
          placeholder="选择日期"
          :disabled-date="disabledDate"
          format="YYYY年M月D日"
          value-format="YYYY-MM-DD"
          class="filter-date"
        />
        <el-select
          v-model="selectedCity"
          placeholder="全部城市"
          clearable
          @clear="clearCity"
          class="filter-city"
        >
          <el-option
            v-for="city in cityList"
            :key="city"
            :label="city"
            :value="city"
          />
        </el-select>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="empty-state">
      <span class="empty-icon">⏳</span>
      <p>正在寻找有空档的工作室...</p>
    </div>

    <!-- 网络错误 -->
    <div v-else-if="errorMsg" class="empty-state">
      <span class="empty-icon">📡</span>
      <p>{{ errorMsg }}</p>
      <button class="btn-clear" @click="fetchAvailable">重试</button>
    </div>

    <!-- 空结果 -->
    <div v-else-if="!studioList.length" class="empty-state">
      <span class="empty-icon">📅</span>
      <p>{{ selectedDate }} 暂无可用工作室</p>
      <p class="empty-hint">试试选择其他日期吧~</p>
    </div>

    <!-- 结果 -->
    <template v-else>
      <div class="result-count">
        {{ selectedDate }} 共有 <strong>{{ studioList.length }}</strong> 个工作室可预约
      </div>

      <div class="studio-grid">
        <div
          v-for="studio in studioList"
          :key="studio.id"
          class="glass-card"
          @click="goDetail(studio)"
        >
          <div class="card-cover">
            <img
              v-if="studio.coverUrl"
              :src="studio.coverUrl"
              :alt="studio.title"
              class="cover-img"
            />
            <div v-else class="cover-ph">
              <span>📸</span>
            </div>
            <span v-if="studio.isStyleEnabled" class="cover-tag">多样式</span>
          </div>

          <div class="card-body">
            <h3 class="card-title">{{ studio.title }}</h3>
            <p v-if="studio.description" class="card-desc">{{ studio.description }}</p>

            <div class="card-meta">
              <span v-if="studio.city" class="meta-item">📍 {{ studio.city }}</span>
              <span v-if="studio.baseStartTime" class="meta-item">
                🕐 {{ studio.baseStartTime }}—{{ studio.baseEndTime }}
              </span>
            </div>

            <div class="card-chips">
              <span v-if="studio.singlePrice" class="chip chip-price">¥{{ studio.singlePrice }}/张</span>
              <span v-if="studio.packagePrice" class="chip chip-pkg">套餐 ¥{{ studio.packagePrice }}</span>
              <span class="chip chip-deposit">定金{{ studio.depositRatio || 30 }}%</span>
            </div>
          </div>

          <div class="card-footer">
            <button class="btn-book" @click.stop="goBooking(studio)">立即预约</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.filter-page {
  max-width: 1280px;
  margin: 0 auto;
  padding-bottom: 24px;
}

/* ── 筛选栏 ── */
.filter-bar {
  background: linear-gradient(135deg, #fce4ec, #f3e5f5);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 16px rgba(173, 20, 87, 0.08);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.filter-label {
  font-size: 15px;
  font-weight: 600;
  color: #7b1fa2;
  white-space: nowrap;
}

.filter-date {
  width: 220px;
}

.filter-city {
  width: 160px;
}

.result-count {
  font-size: 14px;
  color: #9e9e9e;
  margin-bottom: 16px;
  padding-left: 4px;
}

.result-count strong {
  color: #ad1457;
  font-weight: 700;
}

/* ── 空状态 ── */
.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: #9e9e9e;
}

.empty-icon {
  font-size: 56px;
  display: block;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state p {
  font-size: 16px;
  margin: 0 0 8px;
  color: #757575;
}

.empty-hint {
  font-size: 14px;
  color: #bdbdbd;
  margin-bottom: 16px;
}

.btn-clear {
  margin-top: 12px;
  padding: 8px 20px;
  border-radius: 20px;
  border: 1px solid #e1bee7;
  background: rgba(255, 255, 255, 0.7);
  color: #7b1fa2;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-clear:hover {
  background: #fff;
  border-color: #ce93d8;
}

/* ── 卡片宫格 ── */
.studio-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

@media (max-width: 1024px) {
  .studio-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 768px) {
  .studio-grid { grid-template-columns: 1fr; gap: 16px; }
  .filter-row { flex-direction: column; align-items: flex-start; }
  .filter-date, .filter-city { width: 100%; }
}

/* ── glass-card ── */
.glass-card {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease;
  display: flex;
  flex-direction: column;
}

.glass-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.08);
}

/* ── 封面图 ── */
.card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: linear-gradient(135deg, #FEFBF6, #F0F4F8);
}

.cover-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.glass-card:hover .cover-img {
  transform: scale(1.06);
}

.cover-ph {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 48px; opacity: 0.4;
}

.cover-tag {
  position: absolute; top: 12px; right: 12px;
  font-size: 10px; font-weight: 700;
  padding: 4px 12px; border-radius: 20px;
  background: rgba(244, 164, 96, 0.7); color: #fff; z-index: 2;
}

/* ── 信息区 ── */
.card-body {
  padding: 16px 16px 8px;
  flex: 1;
  display: flex; flex-direction: column; gap: 6px;
}

.card-title {
  font-size: 15px; font-weight: 700; color: #4A4A4A;
  display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.card-desc {
  font-size: 12px; color: #8E8E8E; margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.card-meta {
  display: flex; flex-wrap: wrap; gap: 8px;
  font-size: 12px; color: #8b8d91;
}

.meta-item { display: inline-flex; align-items: center; gap: 3px; }

/* Chips */
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
.chip-deposit { color: #8E8E8E; }

/* ── 底部按钮 ── */
.card-footer { padding: 8px 16px 14px; }

.btn-book {
  width: 100%; padding: 12px 0; border: none;
  border-radius: 24px; font-size: 14px; font-weight: 700; cursor: pointer;
  background: linear-gradient(135deg, #f48fb1, #ce93d8);
  color: #fff;
  box-shadow: 0 4px 14px rgba(244, 143, 177, 0.3);
  transition: all 0.25s ease;
}

.btn-book:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(244, 143, 177, 0.4);
}
</style>
