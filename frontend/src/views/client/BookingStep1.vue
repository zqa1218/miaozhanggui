<template>
  <div class="booking-step1 fade-in-up">
    <h4>窗口 1 — 选择服务与时间预估</h4>

    <!-- 样式选择 (isStyleEnabled) -->
    <div v-if="store.studio.isStyleEnabled" class="section">
      <label class="sec-label">选择拍摄样式 <span class="req">*</span></label>
      <el-radio-group v-model="store.selectedStyleId" @change="onParamChange">
        <div v-for="s in store.studio.styles" :key="s.id" class="style-opt">
          <el-radio :value="s.id">
            {{ s.styleName }} — 单张¥{{ s.singlePrice }}
            <template v-if="s.hasPackage"> / 套餐¥{{ s.packagePrice }}</template>
          </el-radio>
        </div>
      </el-radio-group>
    </div>

    <!-- 服务类型 -->
    <div class="section">
      <label class="sec-label">服务类型</label>
      <el-radio-group v-model="store.optType" @change="onParamChange">
        <el-radio value="single">按单张</el-radio>
        <el-radio value="package">选套餐</el-radio>
      </el-radio-group>
    </div>

    <!-- 拍摄张数 -->
    <div v-if="store.optType === 'single'" class="section">
      <label class="sec-label">拍摄张数</label>
      <el-input-number v-model="store.photoCount" :min="1" @change="onParamChange" />
    </div>

    <!-- 模特经验 -->
    <div v-if="store.studio.isExperienceEnabled" class="section">
      <label class="sec-label">模特经验</label>
      <el-radio-group v-model="store.modelExperience" @change="onParamChange">
        <el-radio value="experienced">老手</el-radio>
        <el-radio value="newcomer">新人 (+{{ optTypeAddTime }}分钟)</el-radio>
      </el-radio-group>
    </div>

    <!-- 预约日期 -->
    <div class="section">
      <label class="sec-label">预约日期</label>
      <el-date-picker
        v-model="store.bookingStartDate"
        type="date"
        placeholder="选择日期"
        :disabled-date="disabledDate"
        @change="onParamChange"
      />
    </div>

    <!-- 起始时间 -->
    <div class="section">
      <label class="sec-label">起始时间</label>
      <el-time-select
        v-model="store.bookingStartTime"
        :min-time="store.studio.baseStartTime || '09:00'"
        :max-time="store.studio.baseEndTime || '21:00'"
        start="00:00" step="00:30" end="23:30"
        placeholder="选择时间"
        @change="onParamChange"
      />
    </div>

    <!-- 实时看板 -->
    <div v-if="store.bookingStartTime && store.bookingEndTime" class="panel">
      <div class="panel-header">预计拍摄时间段</div>
      <div class="panel-time">{{ store.bookingStartTime }} 至 {{ store.bookingEndTime }}</div>
      <div class="panel-detail">
        基础{{ store.optType === 'single' ? '单张' : '套餐' }}{{ store.totalDuration }}分钟
        | 价格: ¥{{ store.totalPrice }} | 定金({{ store.studio.depositRatio || 30 }}%): ¥{{ store.depositAmount }}
      </div>
    </div>

    <!-- 碰撞检测结果 -->
    <div v-if="store.checking" class="collision-checking">检测时段可用性...</div>
    <div v-if="store.collisionErrors.length" class="collision-errors">
      <div v-for="(e, i) in store.collisionErrors" :key="i" class="err-item">
        <i class="fa-solid fa-triangle-exclamation"></i> 冲突: {{ e }}
      </div>
    </div>
    <div v-if="!store.checking && store.bookingEndTime && store.collisionErrors.length === 0" class="collision-ok">
      <i class="fa-solid fa-circle-check"></i> 该时段可用
    </div>

    <!-- 可用间隙 -->
    <div v-if="store.availableGaps.length" class="available-gaps">
      <span class="gap-label">今日可用时段:</span>
      <span v-for="(g, i) in store.availableGaps" :key="i" class="gap-tag">{{ g.start }}-{{ g.end }}</span>
    </div>

    <div class="step-footer">
      <el-button type="primary" :disabled="!store.canProceed" @click="store.nextStep()">
        下一步
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useBookingStore } from '@/stores/booking'

const store = useBookingStore()

const optTypeAddTime = computed(() => {
  if (!store.studio) return 0
  return store.optType === 'single'
    ? (store.studio.noviceSingleAddTime || 0)
    : (store.studio.novicePackageAddTime || 0)
})

function onParamChange() {
  if (store.bookingStartDate && store.bookingStartTime) {
    store.checkCollision()
  }
}

function disabledDate(time) {
  return time.getTime() < Date.now() - 8.64e7
}
</script>

<style scoped>
.booking-step1 { max-width: 500px; }
h4 { margin-bottom: 16px; }
.section { margin-bottom: 14px; }
.sec-label { display: block; margin-bottom: 4px; font-weight: 600; font-size: 14px; }
.req { color: #e74c3c; }
.style-opt { padding: 6px 0; }
.panel { background: var(--color-success-bg, #e8f0eb); border-radius: 10px; padding: 14px; margin-top: 12px; }
.panel-header { font-size: 13px; color: #5a7a65; margin-bottom: 4px; }
.panel-time { font-size: 20px; font-weight: 700; color: #5a7a65; }
.panel-detail { font-size: 13px; color: #666; margin-top: 4px; }
.collision-checking { color: #999; font-size: 13px; margin-top: 8px; }
.collision-errors { margin-top: 8px; }
.err-item { color: #C87878; font-size: 13px; padding: 6px 10px; background: var(--color-danger-bg, #FDF2F2); border-radius: 8px; margin-bottom: 4px; }
.collision-ok { color: #5A8A6A; font-size: 13px; margin-top: 8px; }
.available-gaps { margin-top: 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.gap-label { font-size: 12px; color: var(--text-secondary, #8E8E8E); }
.gap-tag { background: var(--color-success-bg, #EDF6F0); color: #5A8A6A; padding: 4px 10px; border-radius: 8px; font-size: 12px; }
.step-footer { display: flex; justify-content: flex-end; margin-top: 24px; }
</style>
