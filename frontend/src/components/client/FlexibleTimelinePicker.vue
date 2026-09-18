<template>
  <div class="ftp-root" ref="rootRef">
    <!-- 时间刻度标签行 -->
    <div class="ftp-labels">
      <span
        v-for="tick in hourTicks"
        :key="tick.label"
        class="ftp-label"
        :style="{ left: tick.pct + '%' }"
      >{{ tick.label }}</span>
    </div>

    <!-- 时间轴轨道 -->
    <div
      class="ftp-track"
      ref="trackRef"
      @mousedown="onPointerDown"
      @touchstart.prevent="onPointerDown"
    >
      <!-- 不可用块 -->
      <div
        v-for="(block, i) in renderedBlocks"
        :key="'b' + i"
        class="ftp-block"
        :class="block.cssClass"
        :style="{ left: block.leftPct + '%', width: block.widthPct + '%' }"
        :title="block.reason || `${block.start}—${block.end}`"
      >
        <span v-if="block.widthPct > 6" class="ftp-block-label">{{ block.start }}-{{ block.end }}</span>
      </div>

      <!-- 刻度线 -->
      <div
        v-for="tick in allTicks"
        :key="'t' + tick.minutes"
        class="ftp-tick"
        :class="{ major: tick.major }"
        :style="{ left: tick.pct + '%' }"
      />

      <!-- 可用间隙高亮 -->
      <div
        v-for="(gap, i) in availableGaps"
        :key="'g' + i"
        class="ftp-gap"
        :class="{ 'too-short': gap.duration < requiredDuration }"
        :style="{ left: gap.leftPct + '%', width: gap.widthPct + '%' }"
        :title="`${gap.start}—${gap.end} (${gap.duration}min)`"
      />

      <!-- ★ 固定档位图层：档位边界 + 已满态 -->
      <div
        v-for="(s, i) in slotOverlays"
        :key="'sl' + i"
        class="ftp-slot"
        :class="{
          'is-avail': s.available,
          'is-taken': !s.available,
          'is-picked': s.start === selectedStartTime,
        }"
        :style="{ left: s.leftPct + '%', width: s.widthPct + '%' }"
        :title="s.available ? `${s.start}—${s.end} 可预约` : `${s.start}—${s.end} 已被占用`"
      />

      <!-- 拖动悬浮气泡 -->
      <div
        v-if="dragging && dragPreviewTime"
        class="ftp-tooltip"
        :style="{ left: dragPreviewPct + '%' }"
      >
        {{ dragPreviewTime }}
      </div>

      <!-- 选中指示器 -->
      <template v-if="selectedStartTime && cursorPct !== null">
        <div
          class="ftp-cursor"
          :style="{ left: cursorPct + '%' }"
        />
        <div
          v-if="selectedEndTime && endPct !== null && endPct <= 100"
          class="ftp-selected-block"
          :class="{ 'fits': selectedFits, 'overflows': !selectedFits }"
          :style="{ left: cursorPct + '%', width: (endPct - cursorPct) + '%' }"
        />
      </template>
    </div>

    <!-- 底部图例 & 信息 + 微调按钮 -->
    <div class="ftp-footer">
      <span class="ftp-legend">
        <template v-if="isFixed">
          <i class="ftp-dot free"></i> 可选档位
          <i class="ftp-dot booked"></i> 已满档位
        </template>
        <template v-else>
          <i class="ftp-dot free"></i> 可选
          <i class="ftp-dot booked"></i> 已被预约
          <i v-if="hasRestBlocks" class="ftp-dot rest"></i> 休息
        </template>
      </span>
      <span v-if="selectedStartTime" class="ftp-info">
        <button
          class="ftp-nudge"
          :title="isFixed ? '上一档' : '减少 1 分钟'"
          :aria-label="isFixed ? '上一档' : '减少 1 分钟'"
          @pointerdown.stop.prevent="adjustTime(-1)"
        >−</button>
        <span class="ftp-time-display">{{ selectedStartTime }}</span>
        <button
          class="ftp-nudge"
          :title="isFixed ? '下一档' : '增加 1 分钟'"
          :aria-label="isFixed ? '下一档' : '增加 1 分钟'"
          @pointerdown.stop.prevent="adjustTime(1)"
        >+</button>
        <span class="ftp-dur">· {{ isFixed ? `档位 ${slotDuration}min` : `需 ${requiredDuration}min` }}</span>
        <template v-if="!isFixed && !selectedFits">
          <span class="ftp-warn">（时长不足）</span>
        </template>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { checkTimeConflict } from '@/utils/durationCalc'

const props = defineProps({
  /** 营业开始 "HH:mm" */
  openTime: { type: String, default: '09:00' },
  /** 营业结束 "HH:mm" */
  closeTime: { type: String, default: '18:00' },
  /** 不可用时段 [{ start, end, type?: 'booked'|'rest'|'unavailable', reason?, lockType? }] */
  unavailableSlots: { type: Array, default: () => [] },
  /** 拍摄所需时长（分钟） */
  requiredDuration: { type: Number, default: 60 },
  /** 当前选中的起始时间 "HH:mm" */
  selectedStartTime: { type: String, default: '' },
  /** 步长（分钟），默认 1 分钟 */
  step: { type: Number, default: 1 },
  /** 预约时间模式: 'time_axis'(默认, 自由拖动) | 'fixed_slot'(只能选固定档位) */
  mode: { type: String, default: 'time_axis' },
  /** 固定档位列表 [{ start, end, available, blockedBy }]，仅 fixed_slot 使用 */
  slots: { type: Array, default: () => [] },
  /** 档位时长（分钟），仅用于展示 */
  slotDuration: { type: Number, default: 30 },
})

const emit = defineEmits(['update:selectedStartTime', 'select'])

// ---- helpers ----
function toMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function toTime(m) {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0')
}

// ---- 时间轴范围 ----
const totalMin = computed(() => {
  const s = toMin(props.openTime)
  const e = toMin(props.closeTime)
  return e > s ? e - s : 0
})

function pct(minutes) {
  if (totalMin.value <= 0) return 0
  return (minutes / totalMin.value) * 100
}

// ---- 合并 + 排序不可用块 ----
const hasRestBlocks = computed(() =>
  (props.unavailableSlots || []).some(s => s.type === 'rest')
)

const mergedSlots = computed(() => {
  if (!props.unavailableSlots || props.unavailableSlots.length === 0) return []

  const slots = props.unavailableSlots.map(s => ({
    start: toMin(s.start),
    end: toMin(s.end),
    type: s.type || s.cssClass || 'booked',
    reason: s.reason || '',
    lockType: s.lockType || '',
  }))
  slots.sort((a, b) => a.start - b.start)

  const merged = []
  for (const s of slots) {
    const last = merged[merged.length - 1]
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end)
      if (s.type === 'rest') last.type = 'rest'
    } else {
      merged.push({ ...s })
    }
  }
  return merged
})

// ---- 渲染块（裁剪到营业时间边界） ----
const renderedBlocks = computed(() => {
  const bs = toMin(props.openTime)
  const be = toMin(props.closeTime)
  return mergedSlots.value
    .filter(s => s.end > bs && s.start < be)
    .map(s => ({
      start: toTime(Math.max(s.start, bs)),
      end: toTime(Math.min(s.end, be)),
      leftPct: pct(Math.max(s.start - bs, 0)),
      widthPct: pct(Math.min(s.end, be) - Math.max(s.start, bs)),
      cssClass: s.type === 'rest' ? 'is-rest' : 'is-booked',
      reason: s.reason,
    }))
})

// ---- 可用间隙 ----
const availableGaps = computed(() => {
  const bs = toMin(props.openTime)
  const be = toMin(props.closeTime)
  const blocks = mergedSlots.value.filter(s => s.end > bs && s.start < be)
  const gaps = []
  let cursor = bs
  for (const b of blocks) {
    const bStart = Math.max(b.start, bs)
    if (bStart > cursor) {
      gaps.push({ start: cursor, end: bStart })
    }
    cursor = Math.max(cursor, Math.min(b.end, be))
  }
  if (cursor < be) {
    gaps.push({ start: cursor, end: be })
  }
  return gaps.map(g => ({
    start: toTime(g.start),
    end: toTime(g.end),
    duration: g.end - g.start,
    leftPct: pct(g.start - bs),
    widthPct: pct(g.end - g.start),
  }))
})

// ---- 刻度 ----
const hourTicks = computed(() => {
  const bs = toMin(props.openTime)
  const be = toMin(props.closeTime)
  const ticks = []
  for (let m = Math.ceil(bs / 60) * 60; m <= be; m += 60) {
    ticks.push({ label: toTime(m), pct: pct(m - bs) })
  }
  return ticks
})

const allTicks = computed(() => {
  const bs = toMin(props.openTime)
  const be = toMin(props.closeTime)
  const ticks = []
  // 步长 ≤ 5 时只渲染整点和半点刻度，避免数百条刻度线
  const renderStep = props.step <= 5 ? 30 : props.step
  for (let m = bs; m <= be; m += renderStep) {
    ticks.push({
      minutes: m,
      pct: pct(m - bs),
      major: m % 60 === 0,
    })
  }
  return ticks
})

// ---- 选中状态 ----
const selectedEndTime = computed(() => {
  if (!props.selectedStartTime) return ''
  return toTime(toMin(props.selectedStartTime) + props.requiredDuration)
})

const cursorPct = computed(() => {
  if (!props.selectedStartTime) return null
  const bs = toMin(props.openTime)
  return pct(toMin(props.selectedStartTime) - bs)
})

const endPct = computed(() => {
  if (!selectedEndTime.value) return null
  const bs = toMin(props.openTime)
  return pct(toMin(selectedEndTime.value) - bs)
})

const selectedFits = computed(() => {
  if (!props.selectedStartTime) return true
  const sMin = toMin(props.selectedStartTime)
  const eMin = sMin + props.requiredDuration
  // check if the entire block is inside an available gap
  for (const g of availableGaps.value) {
    if (sMin >= toMin(g.start) && eMin <= toMin(g.end)) return true
  }
  return false
})

// ---- 交互：点击/拖动 ----
const trackRef = ref(null)
const rootRef = ref(null)
let dragging = false
const dragPreviewTime = ref('')    // 拖动时悬浮显示的时间
const dragPreviewPct = ref(null)  // 悬浮气泡位置

function clientX(e) {
  return e.touches ? e.touches[0].clientX : e.clientX
}

const isFixed = computed(() => props.mode === 'fixed_slot')

/** 固定档位：落在已满档位上 → null（不挪到别的档）；否则吸附到最近的可用档 */
function resolveFixedSlot(clientX) {
  const rect = trackRef.value.getBoundingClientRect()
  if (!rect.width) return null
  const bs = toMin(props.openTime)
  const be = toMin(props.closeTime)
  const raw = bs + Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * (be - bs)

  const hit = props.slots.find(s => raw >= toMin(s.start) && raw < toMin(s.end))
  if (hit) return hit.available ? toMin(hit.start) : null

  const avail = props.slots.filter(s => s.available)
  if (avail.length === 0) return null
  let best = avail[0]
  for (const s of avail) {
    if (Math.abs(toMin(s.start) - raw) < Math.abs(toMin(best.start) - raw)) best = s
  }
  return toMin(best.start)
}

const slotOverlays = computed(() => {
  if (!isFixed.value) return []
  const bs = toMin(props.openTime)
  return props.slots.map(s => ({
    ...s,
    leftPct: pct(toMin(s.start) - bs),
    widthPct: pct(toMin(s.end) - toMin(s.start)),
  }))
})

function getTimeFromPosition(clientX) {
  if (isFixed.value) return resolveFixedSlot(clientX)
  const rect = trackRef.value.getBoundingClientRect()
  const pctVal = ((clientX - rect.left) / rect.width) * 100
  const bs = toMin(props.openTime)
  const be = toMin(props.closeTime)
  const raw = bs + (pctVal / 100) * (be - bs)
  const clamped = Math.max(bs, Math.min(be, raw))
  const snapped = Math.round(clamped / props.step) * props.step
  return Math.max(bs, Math.min(be - props.requiredDuration, snapped))
}

function canPlaceAt(minutes) {
  if (isFixed.value) {
    return props.slots.some(s => s.available && toMin(s.start) === minutes)
  }
  const endMin = minutes + props.requiredDuration
  if (endMin > toMin(props.closeTime)) return false
  const result = checkTimeConflict(
    { start: toTime(minutes), end: toTime(endMin) },
    mergedSlots.value,
  )
  return !result.hasConflict
}

function updateFromEvent(e) {
  const cx = clientX(e)
  const minutes = getTimeFromPosition(cx)
  const rect = trackRef.value.getBoundingClientRect()
  dragPreviewPct.value = ((cx - rect.left) / rect.width) * 100
  // 固定档位下点到已满档位会返回 null —— 保持当前选中不动，不做任何吸附
  if (minutes === null || minutes === undefined) { dragPreviewTime.value = ''; return }
  dragPreviewTime.value = toTime(minutes)
  if (canPlaceAt(minutes)) {
    emit('update:selectedStartTime', toTime(minutes))
    emit('select', toTime(minutes))
  }
}

function clearDragPreview() {
  dragPreviewTime.value = ''
  dragPreviewPct.value = null
}

function onPointerDown(e) {
  dragging = true
  updateFromEvent(e)
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)
  window.addEventListener('touchmove', onPointerMove, { passive: false })
  window.addEventListener('touchend', onPointerUp)
}

function onPointerMove(e) {
  if (!dragging) return
  e.preventDefault()
  updateFromEvent(e)
}

function onPointerUp() {
  dragging = false
  clearDragPreview()
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
  window.removeEventListener('touchmove', onPointerMove)
  window.removeEventListener('touchend', onPointerUp)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
  window.removeEventListener('touchmove', onPointerMove)
  window.removeEventListener('touchend', onPointerUp)
})

// ---- 微调：+/- 1 分钟 ----
/** 固定档位下按档跳，且只在可用档位之间移动（不会卡在已满档上） */
function jumpSlot(dir) {
  const avail = props.slots.filter(s => s.available)
  if (avail.length === 0) return
  const cur = toMin(props.selectedStartTime)
  const idx = avail.findIndex(s => toMin(s.start) === cur)
  let next
  if (idx < 0) {
    next = dir > 0
      ? (avail.find(s => toMin(s.start) > cur) || avail[avail.length - 1])
      : ([...avail].reverse().find(s => toMin(s.start) < cur) || avail[0])
  } else {
    next = avail[idx + dir]
  }
  if (!next) return
  emit('update:selectedStartTime', next.start)
  emit('select', next.start)
}

function adjustTime(delta) {
  if (!props.selectedStartTime) return
  if (isFixed.value) { jumpSlot(delta > 0 ? 1 : -1); return }
  const cur = toMin(props.selectedStartTime)
  const next = cur + delta
  if (next < toMin(props.openTime)) return
  if (canPlaceAt(next)) {
    emit('update:selectedStartTime', toTime(next))
    emit('select', toTime(next))
  }
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════
   FlexibleTimelinePicker — 清新浅色 · 高辨识度色彩方案
   ═══════════════════════════════════════════════════════════════════ */
.ftp-root {
  user-select: none;
  -webkit-user-select: none;
  padding: 6px 0;
}

/* ---- 时间标签 ---- */
.ftp-labels {
  position: relative; height: 18px; margin-bottom: 4px;
}
.ftp-label {
  position: absolute; transform: translateX(-50%);
  font-size: 10px; color: rgba(0,0,0,0.30); font-weight: 600;
  white-space: nowrap; padding: 1px 6px; border-radius: 8px;
  transition: color 0.3s ease;
}

/* ── 轨道：浅黄卡其色调玻璃底 ── */
.ftp-track {
  position: relative; height: 54px;
  background: rgba(245,238,220,0.60);
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
  border-radius: 18px; cursor: pointer; overflow: hidden;
  border: 1px solid rgba(180,160,120,0.15);
  box-shadow:
    0 2px 16px rgba(160,140,100,0.08),
    inset 0 1px 0 rgba(255,255,255,0.6);
  -webkit-tap-highlight-color: transparent;
  transition: all 0.35s ease;
}
.ftp-track:hover {
  box-shadow:
    0 4px 20px rgba(160,140,100,0.12),
    inset 0 1px 0 rgba(255,255,255,0.7);
}

/* ── 刻度线 ── */
.ftp-tick {
  position: absolute; top: 0; height: 100%; width: 1px;
  background: rgba(0,0,0,0.04); pointer-events: none;
  transition: background 0.3s ease;
}
.ftp-tick.major { background: rgba(0,0,0,0.08); width: 1px; }

/* ═══════════════════════════════════════════════════════════════════
   状态 1：可用空白区 (Available) — 卡其清透玻璃，hover 微光
   ═══════════════════════════════════════════════════════════════════ */
.ftp-gap {
  position: absolute; top: 3px; height: calc(100% - 6px);
  border-radius: 0;
  background: rgba(255,252,242,0.30); pointer-events: none;
  backdrop-filter: blur(2px);
  transition: background 0.3s ease;
}
.ftp-gap.too-short {
  background: rgba(255,225,200,0.20);
  border: 1px dashed rgba(220,170,120,0.22);
}
.ftp-track:hover .ftp-gap:not(.too-short) {
  background: rgba(255,252,242,0.50);
}

/* ═══════════════════════════════════════════════════════════════════
   状态 2：不可用块 (Blocked) — 冷灰条纹，利落方角
   ═══════════════════════════════════════════════════════════════════ */
.ftp-block {
  position: absolute; top: 3px; height: calc(100% - 6px);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; border-radius: 0;
  transition: all 0.3s ease;
}
.ftp-block.is-booked {
  background: rgba(180,180,190,0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.3);
  background-image: repeating-linear-gradient(
    -40deg,
    transparent,
    transparent 4px,
    rgba(0,0,0,0.025) 4px,
    rgba(0,0,0,0.025) 8px
  );
}
.ftp-block.is-rest {
  background: rgba(240,210,160,0.22);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1.5px dashed rgba(200,150,80,0.30);
}
.ftp-block-label {
  font-size: 9px; color: rgba(0,0,0,0.28); white-space: nowrap;
  padding: 0 8px; overflow: hidden; text-overflow: ellipsis;
  transition: color 0.3s ease;
}

/* ═══════════════════════════════════════════════════════════════════
   状态 3：选中时间块 (Selected / Active) — 珊瑚橘+暖金辉光
   视觉焦点，醒目但不刺眼
   ═══════════════════════════════════════════════════════════════════ */
.ftp-cursor {
  position: absolute; top: 3px; bottom: 3px; width: 3px;
  background: linear-gradient(180deg, #F0985C, #E07840);
  z-index: 4; pointer-events: none; border-radius: 2px;
  box-shadow:
    0 0 10px rgba(240,152,92,0.5),
    0 0 22px rgba(240,152,92,0.2);
  transition: left 0.2s cubic-bezier(0.25,0.46,0.45,0.94);
}

.ftp-selected-block {
  position: absolute; top: 3px; bottom: 3px;
  border-radius: 0; z-index: 3; pointer-events: none;
  transition: left 0.2s cubic-bezier(0.25,0.46,0.45,0.94),
              width 0.2s cubic-bezier(0.25,0.46,0.45,0.94),
              background 0.35s ease,
              box-shadow 0.35s ease;
}
.ftp-selected-block.fits {
  background: linear-gradient(
    135deg,
    rgba(250,180,140,0.30) 0%,
    rgba(240,150,100,0.22) 100%
  );
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1.5px solid rgba(240,150,100,0.35);
  box-shadow:
    0 0 16px rgba(240,150,100,0.20),
    0 0 32px rgba(240,150,100,0.08),
    inset 0 1px 0 rgba(255,255,255,0.20);
}
.ftp-selected-block.overflows {
  background: linear-gradient(
    135deg,
    rgba(220,110,100,0.28) 0%,
    rgba(200,80,70,0.20) 100%
  );
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1.5px solid rgba(220,110,100,0.40);
  box-shadow:
    0 0 16px rgba(220,110,100,0.22),
    0 0 32px rgba(220,110,100,0.10),
    inset 0 1px 0 rgba(255,255,255,0.15);
}

/* ═══════════════════════════════════════════════════════════════════
   拖动悬浮气泡 — 浅色玻璃
   ═══════════════════════════════════════════════════════════════════ */
.ftp-tooltip {
  position: absolute; bottom: 100%; transform: translateX(-50%);
  margin-bottom: 8px; z-index: 10; pointer-events: none;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  color: var(--text-1); font-size: 12px; font-weight: 700;
  padding: 4px 14px; border-radius: 16px; white-space: nowrap;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 4px 20px rgba(0,0,0,0.10);
  transition: opacity 0.2s ease;
}
.ftp-tooltip::after {
  content: ''; position: absolute; top: 100%; left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(255,255,255,0.92);
}

/* ═══════════════════════════════════════════════════════════════════
   微调按钮 — 轻量玻璃
   ═══════════════════════════════════════════════════════════════════ */
.ftp-nudge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.10);
  background: rgba(255,255,255,0.60);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: 15px; font-weight: 700; color: #8A6040;
  cursor: pointer; padding: 0; line-height: 1;
  transition: all 0.25s ease;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}
.ftp-nudge:hover {
  border-color: rgba(200,130,80,0.40);
  background: rgba(255,255,255,0.85);
  color: var(--color-primary-ink);
  box-shadow: 0 2px 12px rgba(200,130,80,0.12);
}
.ftp-nudge:active { transform: scale(0.90); }
.ftp-time-display {
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  font-size: 15px; font-weight: 700; color: var(--color-primary-ink);
  min-width: 50px; text-align: center;
  transition: color 0.3s ease;
}

/* ═══════════════════════════════════════════════════════════════════
   底部图例
   ═══════════════════════════════════════════════════════════════════ */
.ftp-footer {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 8px; font-size: 11px; color: rgba(0,0,0,0.38);
}
.ftp-legend { display: flex; align-items: center; gap: 10px; }
.ftp-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 2px;
}
.ftp-dot.free   { background: rgba(0,0,0,0.12); }
.ftp-dot.booked { background: rgba(160,160,175,0.60); }
.ftp-dot.rest   { border: 1.5px dashed rgba(200,150,80,0.50); background: transparent; }
.ftp-info {
  font-weight: 500; display: flex; align-items: center; gap: 6px;
}
.ftp-dur { font-size: 11px; color: rgba(0,0,0,0.25); }
.ftp-warn  { color: var(--color-danger-ink); font-weight: 600; }

/* ═══ 固定档位图层 ═══
   z-index:2 —— 压在 .ftp-gap 之上、选中块(.ftp-selected-block, z-index:3)之下，
   选中态的珊瑚高亮仍然在最上层，整体视觉语言与时间轴模式保持一致。 */
.ftp-slot {
  position: absolute; top: 3px; height: calc(100% - 6px);
  z-index: 2; pointer-events: none;
  transition: background 0.25s ease;
}
.ftp-slot.is-avail {
  background: rgba(255, 255, 255, 0.14);
  border-left: 1px dashed rgba(160, 140, 100, 0.26);
}
.ftp-slot.is-taken {
  background:
    repeating-linear-gradient(-40deg, transparent, transparent 4px,
      rgba(0, 0, 0, 0.05) 4px, rgba(0, 0, 0, 0.05) 8px),
    rgba(180, 180, 190, 0.30);
  border-left: 1px solid rgba(0, 0, 0, 0.07);
}
.ftp-slot.is-picked { background: rgba(240, 150, 100, 0.18); }

@keyframes ftp-fade-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
.ftp-root { animation: ftp-fade-in 0.4s cubic-bezier(0.25,0.46,0.45,0.94); }
</style>
