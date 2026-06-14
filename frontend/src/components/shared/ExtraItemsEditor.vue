<script setup>
import { computed } from 'vue'
import { EXTRA_ITEM_UNIT_OPTIONS } from '@/utils/extraItems'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue'])

const items = computed({
  get: () => props.modelValue || [],
  set: (val) => emit('update:modelValue', val),
})

function add() {
  const arr = [...items.value, { name: '', price: 0, unit: 'per_time' }]
  emit('update:modelValue', arr)
}

function remove(idx) {
  const arr = [...items.value]
  arr.splice(idx, 1)
  emit('update:modelValue', arr)
}

function updateField(idx, field, value) {
  const arr = items.value.map((item, i) =>
    i === idx ? { ...item, [field]: value } : item
  )
  emit('update:modelValue', arr)
}
</script>

<template>
  <div class="extra-editor">
    <div class="extra-editor-hd">
      <span class="extra-editor-title">附加项目</span>
      <span class="extra-editor-hint">{{ items.length }} 个项目</span>
    </div>

    <TransitionGroup name="extra-list" tag="div" class="extra-list">
      <div v-for="(item, idx) in items" :key="idx" class="extra-card">
        <div class="extra-card-bar">
          <span class="extra-card-num">项目 {{ idx + 1 }}</span>
          <el-button size="small" class="extra-del-btn" @click="remove(idx)">删除</el-button>
        </div>
        <div class="extra-card-body">
          <el-form-item label="项目名称" :label-width="80">
            <el-input
              :model-value="item.name"
              placeholder="如：妆造加急"
              maxlength="30"
              @update:model-value="v => updateField(idx, 'name', v)"
            />
          </el-form-item>
          <el-form-item label="金额" :label-width="80">
            <el-input-number
              :model-value="item.price"
              :min="0"
              :precision="2"
              :step="1"
              @update:model-value="v => updateField(idx, 'price', v)"
            />
            <span class="unit">元</span>
          </el-form-item>
          <el-form-item label="计费单位" :label-width="80">
            <el-select
              :model-value="item.unit"
              style="width:160px"
              @update:model-value="v => updateField(idx, 'unit', v)"
            >
              <el-option
                v-for="opt in EXTRA_ITEM_UNIT_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </div>
      </div>
    </TransitionGroup>

    <el-button class="extra-add-btn" @click="add">+ 新增附加项目</el-button>
  </div>
</template>

<style scoped>
.extra-editor {
  margin-top: 12px;
}

.extra-editor-hd {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}

.extra-editor-title {
  font-size: 14px;
  font-weight: 700;
  color: #4A4A4A;
}

.extra-editor-hint {
  font-size: 12px;
  color: #B0B0B0;
}

.extra-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.extra-card {
  border: 1px solid #F0EDE8;
  border-radius: 12px;
  background: #FAFAF8;
  overflow: hidden;
}

.extra-card-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: linear-gradient(135deg, #FDFBF7, #F9F5F0);
  border-bottom: 1px solid #F0EDE8;
}

.extra-card-num {
  font-size: 12px;
  font-weight: 700;
  color: #8a7040;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.extra-del-btn {
  font-size: 12px !important;
  padding: 4px 12px !important;
}

.extra-card-body {
  padding: 8px 16px 14px;
}

.extra-card-body :deep(.el-form-item) {
  margin-bottom: 12px;
}

.extra-card-body :deep(.el-form-item__label) {
  font-size: 12px;
  color: #8E8E8E;
  font-weight: 600;
}

.unit {
  margin-left: 8px;
  font-size: 13px;
  color: #8E8E8E;
}

.extra-add-btn {
  width: 100%;
  margin-top: 10px;
  border: 2px dashed #E0D8CC !important;
  background: transparent !important;
  color: #8a7040 !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  padding: 12px !important;
  border-radius: 12px !important;
  transition: all 0.2s !important;
}

.extra-add-btn:hover {
  border-color: #D4893E !important;
  background: #FEF7EF !important;
  color: #D4893E !important;
}

/* 动画 */
.extra-list-enter-active,
.extra-list-leave-active {
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.extra-list-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.96);
}

.extra-list-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.96);
}

.extra-list-move {
  transition: transform 0.3s ease;
}

@media (max-width: 768px) {
  .extra-card-body :deep(.el-form-item) {
    flex-direction: column;
  }

  .extra-card-body :deep(.el-form-item__label) {
    min-width: auto;
    margin-bottom: 4px;
  }
}
</style>
