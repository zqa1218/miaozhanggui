<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWizardBStore } from '@/stores/wizardB'
import { styleApi } from '@/api/styleApi'
import { studioApi } from '@/api/studioApi'
import { storage } from '@/utils/storage'
import ExtraItemsEditor from '@/components/shared/ExtraItemsEditor.vue'

const router = useRouter()
const store = useWizardBStore()

onMounted(() => {
  if (store.selectedDates.length === 0 && !store.isAllTimeOpen) {
    router.replace('/admin/studio/create/step1')
  }
})

// ---- 样式开关 ----
const isStyleEnabled = ref(store.isStyleEnabled)

// ---- 样式列表 ----
const allStyles = ref([])
const selectedStyleIds = ref([...store.selectedStyleIds])

const stylesLoading = ref(false)
const stylesError = ref('')
let stylesAbortController = null

async function fetchStyles() {
  if (stylesAbortController) stylesAbortController.abort()
  stylesAbortController = new AbortController()

  stylesLoading.value = true
  stylesError.value = ''
  try {
    const mId = storage.get('mzg_admin_mid', '')
    if (!mId) { stylesError.value = '未获取到商家身份，请重新登录'; return }
    const res = await styleApi.list({ mId })
    if (stylesAbortController.signal.aborted) return
    const data = (res && res.data) || (Array.isArray(res) ? res : null) || []
    allStyles.value = data
    if (data.length === 0) stylesError.value = '暂无可用样式，请前往样式库先创建样式'
  } catch (e) {
    if (stylesAbortController && stylesAbortController.signal.aborted) return
    stylesError.value = '样式加载失败，请检查网络连接'
    console.error('fetchStyles error:', e)
  } finally {
    if (!stylesAbortController || !stylesAbortController.signal.aborted) {
      stylesLoading.value = false
    }
  }
}

onMounted(fetchStyles)

onBeforeUnmount(() => {
  if (stylesAbortController) stylesAbortController.abort()
})

watch(isStyleEnabled, (val) => {
  if (val && allStyles.value.length === 0) fetchStyles()
})

function toggleStyle(id) {
  const idx = selectedStyleIds.value.indexOf(id)
  if (idx >= 0) selectedStyleIds.value.splice(idx, 1)
  else selectedStyleIds.value.push(id)
}

// ---- 原生定价 ----
const merchantRole = ref(storage.get('mzg_admin_merchant_role', 'photographer'))
const isMakeupArtist = computed(() => merchantRole.value === 'makeup_artist')

const isExperienceEnabled = ref(store.isExperienceEnabled || false)
const noviceSingleAddTime = ref(store.noviceSingleAddTime || 20)
const hasPackage = ref(store.hasPackage || false)
// ★ 修复: hasPackage 开关关闭时不再静默改写 pricingModel
const pricingModel    = ref(store.pricingModel)
const singlePrice     = ref(store.singlePrice || 0)
const packagePrice    = ref(store.packagePrice || 0)
const packageSessionCount = ref(store.packageSessionCount || 1)
const singleShotTime  = ref(store.singleShotTime || 5)
const packageTime     = ref(store.packageTime || 30)
const depositRatio    = ref(store.depositRatio || 30)
const addressRequired = ref(store.addressRequired || false)
const extraItems      = ref([...store.extraItems])

// pricingModel 变化时同步 hasPackage（仅单向：下拉→开关，不反向）
watch(pricingModel, (val) => {
  if (val === 'package' || val === 'both') {
    hasPackage.value = true
  } else {
    hasPackage.value = false
  }
})

const submitting = ref(false)
const errorMsg = ref('')

async function submitStudio() {
  errorMsg.value = ''

  if (isStyleEnabled.value) {
    if (selectedStyleIds.value.length === 0) {
      errorMsg.value = '请至少选择一个样式'
      return
    }
  } else {
    const model = isMakeupArtist.value ? 'single' : pricingModel.value
    if ((model === 'single' || model === 'both') && (!singlePrice.value || singlePrice.value <= 0)) {
      errorMsg.value = '请填写有效的单次价格'
      return
    }
    if (!isMakeupArtist.value && (model === 'package' || model === 'both') && (!packagePrice.value || packagePrice.value <= 0)) {
      errorMsg.value = '请填写有效的套餐价格'
      return
    }
  }

  store.isStyleEnabled   = isStyleEnabled.value
  store.selectedStyleIds  = [...selectedStyleIds.value]
  store.isExperienceEnabled = isExperienceEnabled.value
  store.noviceSingleAddTime = noviceSingleAddTime.value
  store.hasPackage = isMakeupArtist.value ? false : hasPackage.value
  store.pricingModel      = isMakeupArtist.value ? 'single' : pricingModel.value
  store.singlePrice       = singlePrice.value
  store.packagePrice      = isMakeupArtist.value ? 0 : packagePrice.value
  store.packageSessionCount = isMakeupArtist.value ? 1 : packageSessionCount.value
  store.singleShotTime    = singleShotTime.value
  store.packageTime       = isMakeupArtist.value ? undefined : packageTime.value
  store.depositRatio      = depositRatio.value
  store.addressRequired   = addressRequired.value
  store.extraItems        = extraItems.value.filter(e => e.name.trim())

  submitting.value = true

  try {
    const payload = { ...store.buildPayload, mId: storage.get('mzg_admin_mid', '') }
    await studioApi.create(payload)
    store.resetAll()
    router.push('/admin/studios')
  } catch (e) {
    errorMsg.value = e.message || '创建失败'
  } finally {
    submitting.value = false
  }
}

function goBack() {
  store.isStyleEnabled   = isStyleEnabled.value
  store.selectedStyleIds  = [...selectedStyleIds.value]
  store.isExperienceEnabled = isExperienceEnabled.value
  store.noviceSingleAddTime = noviceSingleAddTime.value
  store.hasPackage       = isMakeupArtist.value ? false : hasPackage.value
  store.pricingModel     = isMakeupArtist.value ? 'single' : pricingModel.value
  store.singlePrice      = singlePrice.value
  store.packagePrice     = isMakeupArtist.value ? 0 : packagePrice.value
  store.packageSessionCount = isMakeupArtist.value ? 1 : packageSessionCount.value
  store.singleShotTime   = singleShotTime.value
  store.packageTime      = isMakeupArtist.value ? 0 : packageTime.value
  store.depositRatio     = depositRatio.value
  store.extraItems       = extraItems.value.filter(e => e.name.trim())
  router.push('/admin/studio/create/step2')
}
</script>

<template>
  <div class="step-page fade-in-up">
    <h2 class="step-title">创建项目 — 第3步：计价模式</h2>

    <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

    <!-- 卡片：定价模式 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">定价模式</span>
      </template>

      <el-form-item label="使用预设">
        <el-switch v-model="isStyleEnabled" />
      </el-form-item>

      <!-- 路径A: 样式库多选 -->
      <template v-if="isStyleEnabled">
        <el-form-item label="选择样式" required>
          <div v-if="stylesLoading" class="hint">加载中...</div>
          <div v-else-if="stylesError && allStyles.length === 0" class="hint" style="color:#EFA8A8">{{ stylesError }}</div>
          <div v-else-if="allStyles.length === 0" class="hint">暂无可用样式，请先创建</div>
          <div v-else class="style-grid">
            <div
              v-for="s in allStyles"
              :key="s.id"
              class="style-card"
              :class="{ selected: selectedStyleIds.includes(s.id) }"
              @click="toggleStyle(s.id)"
            >
              <img v-if="s.styleCoverUrl" :src="s.styleCoverUrl" class="style-cover" />
              <div class="style-check">{{ selectedStyleIds.includes(s.id) ? '✓' : '' }}</div>
              <div class="style-name">{{ s.styleName }}</div>
              <div class="style-price">¥{{ s.singlePrice }}/张{{ s.hasPackage ? ' · 支持套餐' : '' }}</div>
            </div>
          </div>
        </el-form-item>
      </template>

      <!-- 路径B: 原生定价 -->
      <template v-if="!isStyleEnabled">
        <!-- 妆娘模式：不显示定价模式下拉、套餐价格/次数，仅保留单张价格 -->
        <template v-if="isMakeupArtist">
          <el-form-item label="单次价格 (元)" required>
            <el-input-number v-model="singlePrice" :min="0" :precision="2" :step="0.01" />
          </el-form-item>
        </template>
        <template v-else>
          <el-divider />
          <el-form-item label="定价模式" required>
            <el-select v-model="pricingModel" style="width:200px;">
              <el-option label="仅单张" value="single" />
              <el-option label="仅套餐" value="package" />
              <el-option label="单张 + 套餐" value="both" />
            </el-select>
          </el-form-item>

          <el-form-item v-if="pricingModel === 'single' || pricingModel === 'both'" label="单张价格 (元)" required>
            <el-input-number v-model="singlePrice" :min="0" :precision="2" :step="0.01" />
          </el-form-item>

          <template v-if="pricingModel === 'package' || pricingModel === 'both'">
            <el-form-item label="套餐价格 (元)" required>
              <el-input-number v-model="packagePrice" :min="0" :precision="2" :step="0.01" />
            </el-form-item>
            <el-form-item label="套餐包含次数">
              <el-input-number v-model="packageSessionCount" :min="1" />
            </el-form-item>
          </template>
        </template>

        <!-- 附加项目（原生定价模式下可用）—— 三种角色均可使用 -->
        <template v-if="!isStyleEnabled">
          <el-divider />
          <ExtraItemsEditor v-model="extraItems" />
        </template>
      </template>
    </el-card>

    <!-- 卡片：耗时与加时 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">服务耗时与加时</span>
      </template>

      <el-form-item label="单次耗时" required>
        <el-input-number v-model="singleShotTime" :min="1" :max="480" />
        <span class="unit-suffix">分钟</span>
      </el-form-item>
      <el-form-item v-if="!isMakeupArtist && (hasPackage || pricingModel !== 'single')" label="套餐单次耗时">
        <el-input-number v-model="packageTime" :min="1" :max="480" />
        <span class="unit-suffix">分钟</span>
      </el-form-item>

      <el-divider />

      <el-form-item label="开启新手加时模式">
        <el-switch v-model="isExperienceEnabled" />
      </el-form-item>
      <template v-if="isExperienceEnabled">
        <el-form-item label="新人额外加时">
          <el-input-number v-model="noviceSingleAddTime" :min="0" :max="120" :step="5" />
          <span class="unit-suffix">分钟</span>
        </el-form-item>
      </template>
    </el-card>

    <!-- 卡片：套餐与定金 — 妆娘模式只显示定金比例 -->
    <el-card v-if="!isStyleEnabled" shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">定金设置</span>
      </template>

      <!-- 摄影/棚主模式才显示套餐开关 -->
      <el-form-item v-if="!isMakeupArtist" label="提供套餐服务">
        <el-switch v-model="hasPackage" />
      </el-form-item>

      <el-form-item label="定金比例">
        <el-radio-group v-model="depositRatio">
          <el-radio :value="0">0%</el-radio>
          <el-radio :value="5">5%</el-radio>
          <el-radio :value="10">10%</el-radio>
          <el-radio :value="15">15%</el-radio>
          <el-radio :value="20">20%</el-radio>
          <el-radio :value="25">25%</el-radio>
          <el-radio :value="30">30%</el-radio>
          <el-radio :value="35">35%</el-radio>
          <el-radio :value="40">40%</el-radio>
          <el-radio :value="45">45%</el-radio>
          <el-radio :value="50">50%</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-card>

    <!-- 底部操作 -->
    <div class="step-footer">
      <el-button @click="goBack" size="large">上一步</el-button>
      <el-button type="primary" :disabled="submitting" @click="submitStudio" size="large" :loading="submitting">
        {{ submitting ? '创建中...' : '创建项目' }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.step-page {
  max-width: 780px;
  margin: 0 auto;
  padding: 8px 0 32px;
}
.step-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #4A4A4A);
  margin-bottom: 20px;
}

/* 错误 */
.error-msg {
  background: #FDF2F2;
  color: #C87878;
  padding: 12px 18px;
  border-radius: 10px;
  margin-bottom: 16px;
  font-size: 13px;
  font-weight: 500;
}

/* 卡片 */
.step-card {
  margin-bottom: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #F0EDE8);
}
.step-card :deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #F0EDE8);
  background: var(--bg-table-stripe, #FDFBF7);
  border-radius: 12px 12px 0 0;
}
.step-card :deep(.el-card__body) {
  padding: 20px;
}
.card-header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #4A4A4A);
}

/* 表单项 */
:deep(.el-form-item) {
  margin-bottom: 18px;
  display: flex;
  align-items: flex-start;
}
:deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--text-primary, #4A4A4A);
  min-width: 130px;
}

.unit-suffix {
  margin-left: 8px;
  font-size: 13px;
  color: var(--text-secondary, #8E8E8E);
}

/* 样式网格 */
.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 4px;
}
.style-card {
  position: relative;
  border: 2px solid var(--border-color, #F0EDE8);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all .2s;
  background: var(--bg-card, #fff);
  border-color: #F4A460;
}
.style-card.selected {
  border-color: #F4A460;
  background: var(--color-peach-light, #FEF7EF);
}
.style-cover {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 8px;
  background: var(--bg-page, #F9F8F6);
}
.style-check {
  position: absolute;
  top: 8px; right: 8px;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--color-disabled-bg, #F4F2EE);
  color: #F4A460;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  transition: all .2s;
}
.style-card.selected .style-check {
  background: #F4A460;
  color: #fff;
}
.style-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #4A4A4A);
  margin-bottom: 2px;
}
.style-price {
  font-size: 12px;
  color: #D4893E;
  font-weight: 600;
}

/* 通用 */
.hint {
  text-align: center;
  padding: 24px;
  color: #B0B0B0;
  font-size: 13px;
}

/* 底部操作 */
.step-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}
</style>
