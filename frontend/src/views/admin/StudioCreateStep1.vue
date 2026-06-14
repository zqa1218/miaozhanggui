<template>
  <div class="fade-in-up step-content">
    <!-- 区块：基础信息 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">基础信息</span>
      </template>

      <el-form-item label="项目名称" required>
        <el-input v-model="store.step1.title" placeholder="如：Coser摄影体验" maxlength="256" />
      </el-form-item>
      <el-form-item label="地点城市">
        <el-input v-model="store.step1.city" placeholder="如：上海" maxlength="128" />
      </el-form-item>
      <el-form-item label="可选日期" required>
        <div class="date-picker-wrap">
          <el-date-picker
            v-model="store.step1.availableDates"
            type="dates"
            value-format="YYYY-MM-DD"
            placeholder="点击选择可选日期"
            :disabled-date="disabledDate"
            style="width:100%"
          />
          <div v-if="store.step1.availableDates.length > 0" class="date-tags">
            <el-tag
              v-for="(d, idx) in store.step1.availableDates"
              :key="d"
              closable
              type="info"
              size="small"
              @close="store.step1.availableDates.splice(idx, 1)"
            >
              {{ d }}
            </el-tag>
          </div>
          <span class="hint">已选 {{ store.step1.availableDates.length }} 天</span>
        </div>
      </el-form-item>
    </el-card>

    <!-- 区块：联系方式 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">联系方式</span>
      </template>

      <el-form-item label="联系电话">
        <el-input v-model="store.step1.contactPhone" placeholder="如：13800138000" maxlength="32" />
      </el-form-item>
      <el-form-item label="联系微信">
        <el-input v-model="store.step1.contactWechat" placeholder="如：wxid_abc123" maxlength="64" />
      </el-form-item>
    </el-card>

    <!-- 区块：备注 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">备注</span>
      </template>

      <el-form-item label="内部备注">
        <el-input
          v-model="store.step1.remark"
          type="textarea"
          :rows="3"
          placeholder="可填写内部备注信息，不会对客户展示"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
    </el-card>

    <div class="step-footer">
      <el-button
        type="primary"
        :disabled="!canNext"
        @click="store.nextStep()"
      >
        下一步
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStudioCreateStore } from '@/stores/studioCreate'

const store = useStudioCreateStore()

const canNext = computed(() =>
  store.step1.title.trim() && store.step1.availableDates.length > 0
)

function disabledDate(time) {
  return time.getTime() < Date.now() - 8.64e7
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
  border: 1px solid #F0EDE8;
}
.step-card :deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid #F0EDE8;
  background: #FDFBF7;
  border-radius: 12px 12px 0 0;
}
.step-card :deep(.el-card__body) {
  padding: 20px;
}

.card-header-title {
  font-size: 16px;
  font-weight: 700;
  color: #4A4A4A;
}

/* 日期选择区 */
.date-picker-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.date-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 通用 */
.hint { font-size: 12px; color: #B0B0B0; }

/* 统一 el-form-item 间距 */
:deep(.el-form-item) {
  margin-bottom: 18px;
}
:deep(.el-form-item__label) {
  font-weight: 600;
  color: #4A4A4A;
}

/* 底部操作栏 */
.step-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}
</style>
