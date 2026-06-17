<template>
  <div class="fade-in-up step-content">
    <!-- 区块：定价模式 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">定价模式</span>
      </template>

      <el-form-item label="使用预设">
        <el-switch v-model="store.step3.isStyleEnabled" />
      </el-form-item>

      <!-- 分流 A: 启用样式 -->
      <template v-if="store.step3.isStyleEnabled">
        <el-form-item label="选择样式" required>
          <el-checkbox-group v-model="store.step3.selectedStyleIds">
            <div v-for="s in styleStore.styles" :key="s.id" class="style-option">
              <el-checkbox :value="s.id">
                {{ s.styleName }} — 单张¥{{ s.singlePrice }}
                <template v-if="s.hasPackage"> / 套餐¥{{ s.packagePrice }}</template>
              </el-checkbox>
            </div>
          </el-checkbox-group>
          <div v-if="!styleStore.styles.length" class="hint">请先在「预设管理」中创建预设</div>
        </el-form-item>
      </template>

      <!-- 分流 B: 原生计价 -->
      <template v-else>
        <el-form-item label="单张价格" required>
          <el-input-number v-model="store.step3.singlePrice" :min="0" :precision="2" />
          <span class="unit-suffix">元</span>
        </el-form-item>
        <el-form-item label="提供套餐">
          <el-switch v-model="store.step3.hasPackage" />
        </el-form-item>
        <el-form-item v-if="store.step3.hasPackage" label="套餐价格">
          <el-input-number v-model="store.step3.packagePrice" :min="0" :precision="2" />
          <span class="unit-suffix">元</span>
        </el-form-item>

        <el-divider />
        <ExtraItemsEditor v-model="store.step3.extraItems" />
      </template>
    </el-card>

    <!-- 区块：服务时间与加时 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">服务时间与加时</span>
      </template>

      <el-form-item label="单张拍摄时间" required>
        <el-input-number v-model="store.step3.singleShotTime" :min="1" :max="480" />
        <span class="unit-suffix">分钟</span>
      </el-form-item>
      <el-form-item label="套餐拍摄时间">
        <el-input-number v-model="store.step3.packageTime" :min="1" :max="480" />
        <span class="unit-suffix">分钟</span>
      </el-form-item>

      <el-divider />

      <el-form-item label="开启新手加时模式">
        <el-switch v-model="store.step3.isExperienceEnabled" />
      </el-form-item>
      <template v-if="store.step3.isExperienceEnabled">
        <el-form-item label="新人单张加时">
          <el-input-number v-model="store.step3.noviceSingleAddTime" :min="0" :max="240" />
          <span class="unit-suffix">分钟</span>
        </el-form-item>
        <el-form-item label="新人套餐加时">
          <el-input-number v-model="store.step3.novicePackageAddTime" :min="0" :max="240" />
          <span class="unit-suffix">分钟</span>
        </el-form-item>
      </template>
    </el-card>

    <!-- 区块：定金 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">定金设置</span>
      </template>

      <el-form-item label="定金比例">
        <el-radio-group v-model="store.step3.depositRatio">
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
      <el-button @click="store.prevStep()" size="large">上一步</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="handleSubmit" size="large">
        完成并上架项目
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStudioCreateStore } from '@/stores/studioCreate'
import { useStudioStore } from '@/stores/studio'
import { useAuthStore } from '@/stores/auth'
import { useStyleStore } from '@/stores/style'
import ExtraItemsEditor from '@/components/shared/ExtraItemsEditor.vue'

const router = useRouter()
const store = useStudioCreateStore()
const studioStore = useStudioStore()
const auth = useAuthStore()
const styleStore = useStyleStore()
const submitting = ref(false)

onMounted(() => styleStore.fetchStyles(auth.mId))

const canSubmit = computed(() => {
  if (store.step3.isStyleEnabled) {
    return store.step3.selectedStyleIds.length > 0 && store.step3.singleShotTime > 0
  }
  return store.step3.singlePrice >= 0 && store.step3.singleShotTime > 0
})

async function handleSubmit() {
  submitting.value = true
  try {
    const payload = store.buildPayload(auth.mId)
    const res = await studioStore.create(payload)
    if (res) {
      router.push({ name: 'AdminStudios' })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.step-content {
  max-width: 780px;
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

/* 样式选项 */
.style-option {
  margin-bottom: 6px;
  padding: 10px 14px;
  border: 1px solid var(--border-color, #F0EDE8);
  border-radius: 10px;
  transition: border-color 0.2s;
}
.style-option:hover {
  border-color: #F4A460;
}

/* 通用 */
.hint { font-size: 12px; color: #B0B0B0; }
.unit-suffix {
  margin-left: 8px;
  font-size: 13px;
  color: var(--text-secondary, #8E8E8E);
}

/* 统一 el-form-item 间距 */
:deep(.el-form-item) {
  margin-bottom: 18px;
}
:deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--text-primary, #4A4A4A);
}

/* 底部操作栏 */
.step-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  padding: 0 4px;
}
</style>
