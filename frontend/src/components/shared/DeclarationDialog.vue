<template>
  <Teleport to="body">
    <div v-if="visible" class="declaration-overlay" @click.self="handleOverlayClick">
      <div class="declaration-box">
        <button v-if="canClose" class="declaration-close" @click="handleClose">&times;</button>

        <h3 class="declaration-title">声明</h3>

        <div class="declaration-body">
          <p v-for="(line, i) in filteredLines" :key="i" class="declaration-line">{{ line }}</p>
          <p v-if="filteredLines.length === 0" class="declaration-line" style="color:#999;">暂无声明内容</p>
        </div>

        <div class="declaration-footer">
          <button
            class="declaration-btn"
            :disabled="!canClose"
            @click="handleClose"
          >
            {{ canClose ? '我知道了' : `请仔细阅读（${countdown}秒后可关闭）` }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  content: { type: String, default: '' },
  studioId: { type: [Number, String], default: null },
})

const emit = defineEmits(['update:modelValue', 'close'])

const visible = computed(() => props.modelValue)
const countdown = ref(2)
const canClose = ref(false)
let timer = null

function parseContent() {
  if (!props.content || !props.content.trim()) return []
  // 尝试 JSON 格式
  try {
    const parsed = JSON.parse(props.content)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  // 兼容旧文本格式: "1. xxx\n2. yyy"
  return props.content.split('\n')
    .filter(line => line.trim())
    .map(line => ({
      text: line.replace(/^\d+\.\s*/, '').trim(),
      studioIds: [],
    }))
}

const parsedItems = computed(() => parseContent())

const filteredLines = computed(() => {
  const items = parsedItems.value
  if (items.length === 0) return []
  const sid = props.studioId != null ? Number(props.studioId) : null
  const filtered = items.filter(item => {
    // studioIds 为空 = 适用于全部项目
    if (!item.studioIds || item.studioIds.length === 0) return true
    // studioIds 非空 = 仅在指定项目中展示
    if (sid != null) return item.studioIds.map(Number).includes(sid)
    return false
  })
  return filtered.map((item, i) => `${i + 1}. ${item.text}`)
})

function startCountdown() {
  canClose.value = false
  countdown.value = 2
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      timer = null
      canClose.value = true
    }
  }, 1000)
}

function stopCountdown() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function handleClose() {
  if (!canClose.value) return
  stopCountdown()
  emit('update:modelValue', false)
  emit('close')
}

function handleOverlayClick() {
  // 遮罩层不允许关闭
}

function onKeydown(e) {
  if (e.key === 'Escape' && canClose.value) {
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

watch(() => props.modelValue, (val) => {
  if (val) {
    startCountdown()
  } else {
    stopCountdown()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  stopCountdown()
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.declaration-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.declaration-box {
  background: #fff;
  border-radius: 20px;
  padding: 28px 24px 20px;
  max-width: 420px;
  width: 100%;
  position: relative;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
}

.declaration-close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  font-size: 22px;
  color: #8E8E8E;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  border-radius: 6px;
  transition: color .15s;
}
.declaration-close:hover { color: #4A4A4A; }

.declaration-title {
  font-size: 17px;
  font-weight: 700;
  color: #4A4A4A;
  margin: 0 0 16px;
  text-align: center;
}

.declaration-body {
  flex: 1;
  overflow-y: auto;
  max-height: 50vh;
  padding: 0 4px;
  margin-bottom: 20px;
}

.declaration-line {
  font-size: 14px;
  line-height: 1.8;
  color: #4A4A4A;
  margin: 0 0 6px;
  padding: 6px 10px;
  background: #FAFAF8;
  border-radius: 8px;
  text-align: left;
}

.declaration-footer {
  text-align: center;
}

.declaration-btn {
  width: 100%;
  padding: 12px 24px;
  border: none;
  border-radius: 28px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s;
  font-family: inherit;
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  color: #fff;
  box-shadow: 0 4px 16px rgba(244, 164, 96, 0.22);
}
.declaration-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
.declaration-btn:not(:disabled):hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

/* ── 移动端适配 ── */
@media (max-width: 767px) {
  .declaration-box {
    max-width: 95%;
    padding: 24px 16px 16px;
    border-radius: 16px;
    max-height: 85vh;
  }
  .declaration-title { font-size: 16px; }
  .declaration-line { font-size: 13px; padding: 5px 8px; }
  .declaration-body { max-height: 55vh; }
  .declaration-btn { font-size: 14px; padding: 12px 20px; }
}
</style>
