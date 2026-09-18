<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Clock, LocationInformation } from '@element-plus/icons-vue'
import AppIllustration from '@/components/shared/AppIllustration.vue'
import placeholder4x3 from '@/assets/images/placeholder-4x3.svg'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()

const loading = ref(false)
const allStudios = ref([])
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const selectedCity = ref('')
const cityList = ref([])
const errorMsg = ref('')

const { theme } = useTheme()
const isGlass = computed(() => theme.value === 'glass')

/* 筛选生效时的反馈策略。
   现状：改日期会走 fetchAvailable，loading 一置真就**整块替换**结果区为加载插画，
   数据回来再换回来 —— 用户看到的是整页闪烁 + 一次重排（内容高度也变了）。

   glass 下改为「保留旧结果 + 顶部细进度条」：不闪、不重排，
   进度条是唯一的变化。city 过滤本来就是纯前端计算，瞬间完成，不涉及这里。

   classic 下 showLoadingBlock 恒等于 loading，行为与改造前逐帧一致。 */
const showLoadingBlock = computed(
  () => loading.value && (!isGlass.value || !studioList.value.length)
)
const showGlassProgress = computed(() => isGlass.value && loading.value && studioList.value.length > 0)

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
        <label class="filter-label">日期</label>
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

    <!-- 加载中（glass 下若已有结果则不整块替换，见 showLoadingBlock 注释） -->
    <div v-if="showLoadingBlock" class="empty-state">
      <!-- 加载态插画：按设计说明用 CSS 旋转，不引入 Lottie -->
      <AppIllustration name="empty-loading" :width="160" class="is-spinning" />
      <p>正在寻找有空档的工作室...</p>
    </div>

    <!-- 网络错误 -->
    <div v-else-if="errorMsg" class="empty-state">
      <AppIllustration name="empty-network-error" :width="160" />
      <p>{{ errorMsg }}</p>
      <button class="btn-clear" @click="fetchAvailable">重试</button>
    </div>

    <!-- 空结果 -->
    <div v-else-if="!studioList.length" class="empty-state">
      <AppIllustration name="empty-no-studio" :width="160" />
      <p>{{ selectedDate }} 暂无可用工作室</p>
      <p class="empty-hint">试试选择其他日期吧~</p>
    </div>

    <!-- 结果 -->
    <template v-else>
      <!-- glass：筛选进行中，只走一条细进度条，结果区保持不动。
           role="status" + sr-only 文本让读屏用户也知道正在更新 ——
           纯视觉的进度条对读屏是不存在的。 -->
      <div v-if="showGlassProgress" class="filter-progress" role="status">
        <span class="filter-progress__bar"></span>
        <span class="sr-only">正在按所选日期更新结果</span>
      </div>

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
            <img v-else :src="placeholder4x3" alt="" class="cover-img" />
            <span v-if="studio.isStyleEnabled" class="cover-tag">多样式</span>
          </div>

          <div class="card-body">
            <h3 class="card-title">{{ studio.title }}</h3>
            <p v-if="studio.description" class="card-desc">{{ studio.description }}</p>

            <div class="card-meta">
              <span v-if="studio.city" class="meta-item">
                <el-icon><LocationInformation /></el-icon>{{ studio.city }}
              </span>
              <span v-if="studio.baseStartTime" class="meta-item">
                <el-icon><Clock /></el-icon>{{ studio.baseStartTime }}—{{ studio.baseEndTime }}
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
  max-width: var(--w-wide);
  margin: 0 auto;
  padding-bottom: var(--space-6);
}

/* ── 筛选栏 ──
   原为 Material 玫红→紫渐变（#fce4ec → #f3e5f5）。C 端首屏是全站最该体现
   品牌的地方，这里却与暖杏体系完全断裂，改为暖杏调的磨砂面板。 */
.filter-bar {
  background: linear-gradient(135deg,
              var(--color-primary-tint) 0%,
              var(--surface-1) 60%);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-hairline);
  border-radius: var(--radius-panel);
  padding: var(--space-5);
  margin-bottom: var(--space-5);
  box-shadow: var(--shadow-2), var(--glass-highlight);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.filter-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-primary-ink);
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
  color: var(--text-3);
  margin-bottom: var(--space-4);
  padding-left: 4px;
}

.result-count strong {
  color: var(--color-primary-ink);
  font-weight: 700;
}

/* ── 空状态 ── */
.empty-state {
  text-align: center;
  padding: 64px 20px;
  color: var(--text-3);
}

.empty-icon {
  display: block;
  margin-bottom: var(--space-4);
  font-size: 48px;
  color: var(--color-primary-dark);
}

.empty-state p {
  font-size: 16px;
  margin: 0 0 var(--space-2);
  color: var(--text-3);
}

.empty-hint {
  font-size: 14px;
  color: var(--text-3);
  margin-bottom: var(--space-4);
}

.btn-clear {
  margin-top: var(--space-3);
  height: 34px; padding: 0 20px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-primary-line);
  background: var(--surface-solid);
  color: var(--color-primary-ink);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--duration-1) var(--ease-out),
              border-color var(--duration-1) var(--ease-out);
}

.btn-clear:hover {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
}

/* ── 卡片宫格 ── */
.studio-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-5);
}

@media (max-width: 1024px) {
  .studio-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 768px) {
  .studio-grid { grid-template-columns: 1fr; gap: var(--space-4); }
  .filter-row { flex-direction: column; align-items: flex-start; }
  .filter-date, .filter-city { width: 100%; }
}

/* ── glass-card ──
   宫格卡片刻意「不加」backdrop-filter：一屏 20 张卡意味着 20 次离屏模糊，
   移动端必掉帧。半透明靠 --surface-1 的 alpha 合成实现，GPU 成本为零。 */
.glass-card {
  background: var(--surface-1);
  border: 1px solid var(--glass-hairline);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--shadow-1);
  cursor: pointer;
  transition: transform var(--duration-2) var(--ease-out),
              box-shadow var(--duration-2) var(--ease-out);
  display: flex;
  flex-direction: column;
}

.glass-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-3);
}

/* ── 封面图 ── */
.card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: linear-gradient(135deg, var(--color-primary-tint), var(--color-sky-light));
}

.cover-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--duration-3) var(--ease-out);
}

.glass-card:hover .cover-img {
  transform: scale(1.04);
}

.cover-ph {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 40px; color: var(--color-primary-dark);
}

.cover-tag {
  position: absolute; top: 10px; right: 10px;
  font-size: 11px; font-weight: 700;
  padding: 3px 10px; border-radius: var(--radius-pill);
  background: var(--color-primary); color: var(--text-on-primary); z-index: 2;
}

/* ── 信息区 ── */
.card-body {
  padding: var(--space-4) var(--space-4) var(--space-2);
  flex: 1;
  display: flex; flex-direction: column; gap: 6px;
}

.card-title {
  font-size: 15px; font-weight: 700; color: var(--text-1);
  display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.card-desc {
  font-size: 12px; color: var(--text-3); margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.card-meta {
  display: flex; flex-wrap: wrap; gap: var(--space-2);
  font-size: 12px; color: var(--text-3);
}

.meta-item { display: inline-flex; align-items: center; gap: 4px; }

/* Chips */
.card-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: auto; padding-top: var(--space-2);
}

.chip {
  font-size: 11px; padding: 3px 10px; border-radius: var(--radius-pill);
  font-weight: 600; white-space: nowrap;
}

.chip-price { background: var(--color-primary-tint); color: var(--color-primary-ink); }
.chip-pkg   { background: var(--color-info-tint);    color: var(--color-info-ink); }
.chip-deposit { color: var(--text-3); }

/* ── 底部按钮 ──
   原为 Material 粉紫渐变（#f48fb1 → #ce93d8），是全站最显眼的跑偏点。 */
.card-footer { padding: var(--space-2) var(--space-4) var(--space-4); }

.btn-book {
  width: 100%; height: 38px; border: none;
  border-radius: var(--radius-btn);
  font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
  background: var(--color-primary-gradient);
  color: var(--text-on-primary);
  box-shadow: var(--shadow-primary);
  transition: box-shadow var(--duration-2) var(--ease-out),
              transform var(--duration-1) var(--ease-out);
}

.btn-book:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(var(--color-primary-rgb), .30);
}

/* ══════════════════════════════════════════════════════════════
   glass 主题细化
   -------------------------------------------------------------
   为什么写在组件 scoped 块里而不是 glass-app.css：
   本组件的样式编译成 `.filter-bar[data-v-xxx]`（0,2,0），且位于路由 chunk 的
   CSS 中、**加载顺序晚于主 CSS 包**。在主 CSS 里写同特异性的规则会输。
   写在这里，Vue 把属性选择器加到最后一段，特异性自然变成 (0,3,0)，
   既稳赢又与被覆盖的规则放在一起，改的时候不会两边找。
   所有规则都以 `:root[data-theme="glass"]` 开头 —— classic 下一行都不命中。
   ══════════════════════════════════════════════════════════════ */

/* 筛选栏吸顶。
   top 取 56px 是为了落在 ClientLayout 的 .nav-bar 下方（该条 sticky top:0，
   高度 = logo 32px + 上下 padding 各 12px）。这两个值是一处隐式耦合，
   改 ClientLayout 的导航高度时要同步改这里。 */
:root[data-theme="glass"] .filter-bar {
  position: sticky;
  top: 56px;
  z-index: var(--z-sticky);
  background: var(--surface-glass-strong);
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  backdrop-filter: var(--glass-blur);
  border-color: var(--glass-stroke);
  border-top-color: var(--glass-edge-top);
}

/* 筛选进度条：不替换结果区，只在顶部走一条 2px 线。
   只动 transform，不动 width —— 避免每帧触发布局。 */
.filter-progress {
  position: relative;
  height: 2px;
  margin: -8px 0 var(--space-3);
  border-radius: 2px;
  overflow: hidden;
  background: var(--border-subtle);
}
.filter-progress__bar {
  position: absolute;
  inset: 0;
  border-radius: 2px;
  background: var(--color-primary-gradient);
  transform-origin: left center;
  animation: filterBar 1.1s var(--ease-out) infinite;
}
@keyframes filterBar {
  0%   { transform: translateX(-100%) scaleX(.35); }
  100% { transform: translateX(100%) scaleX(.35); }
}
/* 进度条表达的是「正在加载」这一状态信息，不是装饰；
   但前庭敏感用户仍需能关掉，故在 reduced-motion 下改为静态满条。 */
@media (prefers-reduced-motion: reduce) {
  .filter-progress__bar {
    animation: none;
    transform: none;
    opacity: .55;
  }
}

/* 只给读屏的文本 */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 767px) {
  /* 小屏上筛选栏本身变高（控件换行），吸顶位置相应下移会挤占过多视口，
     故小屏取消吸顶，改为随页面滚动。 */
  :root[data-theme="glass"] .filter-bar {
    position: static;
  }
}
</style>
