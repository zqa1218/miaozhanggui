<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { studioApi } from '@/api/studioApi'
import { styleApi } from '@/api/styleApi'
import { storage } from '@/utils/storage'
import { validateImageFile } from '@/utils/validateFile'
import { ElMessage } from 'element-plus'
import { Delete, Close, DeleteFilled, WarningFilled } from '@element-plus/icons-vue'
import ExtraItemsEditor from '@/components/shared/ExtraItemsEditor.vue'
import OpenDateSelector from '@/components/shared/OpenDateSelector.vue'
import { normalizeExtraItems, normalizeExtraItemsForSubmit } from '@/utils/extraItems'
import { normalizeOpenDateConfig, normalizeDateArray } from '@/utils/openDates'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)
const mId = ref(storage.get('mzg_admin_mid', ''))

// ── 角色判断 ──
const merchantRole = ref(storage.get('mzg_admin_merchant_role', 'photographer'))
const isMakeupArtist = computed(() => merchantRole.value === 'makeup_artist')

const loading = ref(true)
const saving = ref(false)
const errorMsg = ref('')

// ── 基础信息 ──
const title = ref('')
const city = ref('')
const description = ref('')
const coverUrl = ref('')
const detailImgUrls = ref([])

// ── 图片删除模式 ──
const isDeleteMode = ref(false)
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)
const deleteTarget = ref(null) // { type: 'cover'|'detail', url: string, index?: number }

function toggleDeleteMode() {
  isDeleteMode.value = !isDeleteMode.value
}

function confirmDeleteImage(type, url, idx) {
  deleteTarget.value = { type, url, index: idx }
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    await studioApi.removeImage(id, deleteTarget.value.url, deleteTarget.value.type)
    if (deleteTarget.value.type === 'cover') {
      coverUrl.value = ''
    } else if (deleteTarget.value.index !== undefined) {
      detailImgUrls.value.splice(deleteTarget.value.index, 1)
    }
    ElMessage.success('图片已删除')
    showDeleteConfirm.value = false
    deleteTarget.value = null
    isDeleteMode.value = false
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  } finally {
    isDeleting.value = false
  }
}

// ── 封面图上传 ──
const coverFile = ref(null)
const uploadingCover = ref(false)
const coverUploadMsg = ref('')
function onCoverChange(e) { coverFile.value = e.target.files[0] || null; coverUploadMsg.value = '' }
async function uploadCover() {
  if (!coverFile.value) return
  uploadingCover.value = true; coverUploadMsg.value = ''
  try {
    const fd = new FormData(); fd.append('file', coverFile.value); fd.append('folder', 'covers')
    const token = storage.get('mzg_admin_token', '')
    const deviceId = storage.get('mzg_device_id', '') || ('adm_' + Date.now())
    const res = await fetch('/api/upload/image', {
      method: 'POST', headers: { 'x-device-id': deviceId, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: fd,
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      coverUrl.value = (res.data && res.data.url) || res.url || ''
      coverUploadMsg.value = 'success'; coverFile.value = null
      const el = document.getElementById('edit-cover-input'); if (el) el.value = ''
    } else { coverUploadMsg.value = res.message || '上传失败' }
  } catch { coverUploadMsg.value = '网络错误' }
  uploadingCover.value = false
}

// ── 详情图上传 ──
const detailFiles = ref([])
const uploadingDetail = ref(false)
const detailUploadMsg = ref('')
function onDetailChange(e) { detailFiles.value = Array.from(e.target.files || []) }
async function uploadDetails() {
  if (!detailFiles.value.length) return
  uploadingDetail.value = true; detailUploadMsg.value = ''
  try {
    const fd = new FormData(); detailFiles.value.forEach(f => fd.append('files', f)); fd.append('folder', 'details')
    const token = storage.get('mzg_admin_token', '')
    const deviceId = storage.get('mzg_device_id', '') || ('adm_' + Date.now())
    const res = await fetch('/api/upload/images', {
      method: 'POST', headers: { 'x-device-id': deviceId, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: fd,
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      const urls = (res.data && res.data.urls) || res.urls || []
      detailImgUrls.value = [...detailImgUrls.value, ...urls]
      detailUploadMsg.value = 'success'; detailFiles.value = []
      const el = document.getElementById('edit-detail-input'); if (el) el.value = ''
    } else { detailUploadMsg.value = res.message || '上传失败' }
  } catch { detailUploadMsg.value = '网络错误' }
  uploadingDetail.value = false
}

// ── 开放日期（统一使用 isAllTimeOpen + selectedDates，与创建页一致）──
const isAllTimeOpen = ref(false)
const selectedDates = ref([])

// ── 时间配置 ──
const baseStartTime = ref('09:00')
const baseEndTime = ref('18:00')
const intervalRestTime = ref(15)
const restSlots = ref([])
const restStart = ref('')
const restEnd = ref('')
function addRestSlot() {
  if (restStart.value && restEnd.value) {
    restSlots.value.push({ start_time: restStart.value, end_time: restEnd.value })
    restStart.value = ''; restEnd.value = ''
  }
}
function removeRestSlot(idx) { restSlots.value.splice(idx, 1) }

// ── 计价模式 ──
const isStyleEnabled = ref(false)
const isExperienceEnabled = ref(false)
const addressRequired = ref(false)
const noviceSingleAddTime = ref(0)
const pricingModel = ref('single')  // 'single' | 'package' | 'both'
const singlePrice = ref(0)
const packagePrice = ref(0)
const packageSessionCount = ref(1)
const singleShotTime = ref(60)
const packageTime = ref(120)
const depositRatio = ref(30)
const extraItems = ref([])
const selectedStyleIds = ref([])
const allStyles = ref([])

// hasPackage 由 pricingModel 派生
const hasPackage = computed(() => pricingModel.value === 'package' || pricingModel.value === 'both')

// ── 加载项目数据 ──
onMounted(async () => {
  try {
    const res = await studioApi.list({ mId: mId.value })
    if (res.data && Array.isArray(res.data)) {
      const found = res.data.find(s => s.id === id)
      if (found) {
        title.value = found.title || ''
        city.value = found.city || ''
        description.value = found.description || ''
        coverUrl.value = found.coverUrl || ''
        detailImgUrls.value = (found.detailImgUrls && Array.isArray(found.detailImgUrls)) ? [...found.detailImgUrls] : []
        const dateConfig = normalizeOpenDateConfig(found)
        isAllTimeOpen.value = dateConfig.isAllTimeOpen
        selectedDates.value = dateConfig.selectedDates
        baseStartTime.value = found.baseStartTime || '09:00'
        baseEndTime.value = found.baseEndTime || '18:00'
        intervalRestTime.value = found.intervalRestTime || 15
        restSlots.value = (found.restSlots && Array.isArray(found.restSlots)) ? [...found.restSlots] : []
        isStyleEnabled.value = !!found.isStyleEnabled
        isExperienceEnabled.value = !!found.isExperienceEnabled
        addressRequired.value = !!found.addressRequired
        noviceSingleAddTime.value = found.noviceSingleAddTime || 0
        const foundHasPkg = !!found.hasPackage
        const foundSingle = Number(found.singlePrice) || 0
        singlePrice.value = foundSingle
        packagePrice.value = Number(found.packagePrice) || 0
        if (foundHasPkg) {
          pricingModel.value = foundSingle > 0 ? 'both' : 'package'
        } else {
          pricingModel.value = 'single'
        }
        singleShotTime.value = found.singleShotTime || 60
        packageTime.value = found.packageTime || 120
        packageSessionCount.value = found.packageSessionCount || 1
        depositRatio.value = found.depositRatio || 30
        extraItems.value = normalizeExtraItems(found)
        if (found.selectedStyleIds && Array.isArray(found.selectedStyleIds)) {
          selectedStyleIds.value = [...found.selectedStyleIds]
        }
      }
    }
    // 加载所有样式供关联
    try { const sr = await styleApi.list({ mId: mId.value }); allStyles.value = (sr.data || sr) || [] } catch {}
  } catch (e) { errorMsg.value = '加载项目数据失败' }
  loading.value = false
})

// ── 提交 ──
async function handleSubmit() {
  if (!title.value.trim()) { errorMsg.value = '请输入项目名称'; return }
  if (!isAllTimeOpen.value && selectedDates.value.length === 0) { errorMsg.value = '请至少选择一个开放日期，或开启全时段'; return }
  saving.value = true; errorMsg.value = ''
  try {
    const payload = {
      id, mId: mId.value,
      title: title.value.trim(), city: city.value.trim(), description: description.value.trim(),
      coverUrl: coverUrl.value, detailImgUrls: detailImgUrls.value,
      isAllTimeOpen: isAllTimeOpen.value,
      availableDates: isAllTimeOpen.value ? [] : normalizeDateArray(selectedDates.value),
      baseStartTime: baseStartTime.value, baseEndTime: baseEndTime.value,
      intervalRestTime: intervalRestTime.value,
      restSlots: (restSlots.value || []).filter(s => s.start_time && s.end_time),
      isStyleEnabled: isStyleEnabled.value, isExperienceEnabled: isExperienceEnabled.value,
      noviceSingleAddTime: noviceSingleAddTime.value,
      pricingModel: isMakeupArtist.value ? 'single' : pricingModel.value,
      singlePrice: singlePrice.value,
      depositRatio: depositRatio.value,
      singleShotTime: singleShotTime.value,
      packageTime: isMakeupArtist.value ? undefined : packageTime.value,
      packageSessionCount: isMakeupArtist.value ? undefined : packageSessionCount.value,
      selectedStyleIds: selectedStyleIds.value,
      addressRequired: addressRequired.value,
      hasPackage: isMakeupArtist.value ? false : hasPackage.value,
      packagePrice: (!isMakeupArtist.value && hasPackage.value) ? packagePrice.value : null,
      extraItems: normalizeExtraItemsForSubmit(extraItems.value),
    }
    await studioApi.update(id, payload)
    router.push('/admin/studios')
  } catch (e) {
    errorMsg.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="edit-studio fade-in-up" style="max-width:700px;margin:0 auto;padding:16px;">
    <h1 style="font-size:20px;margin-bottom:16px;">编辑项目</h1>

    <div v-if="loading" style="text-align:center;padding:40px;color:#999;">加载中...</div>

    <template v-else>
      <div v-if="errorMsg" class="error-msg" style="color:#f56c6c;margin-bottom:12px;font-size:13px;">{{ errorMsg }}</div>

      <!-- 基础信息 -->
      <fieldset><legend>基础信息</legend>
        <label>项目名称 <input v-model="title" class="input-field" style="width:100%" /></label>
        <label>所在城市 <input v-model="city" placeholder="如：杭州" class="input-field" style="width:100%" /></label>
        <label>项目描述 <textarea v-model="description" rows="3" class="input-field" style="width:100%"></textarea></label>

        <!-- 封面图 — 带删除模式 -->
        <div class="image-section" :class="{ 'delete-mode': isDeleteMode }">
          <div class="section-header">
            <label style="margin-bottom:0;">封面图</label>
            <button
              :class="['delete-trigger-btn', { 'is-active': isDeleteMode }]"
              @click="toggleDeleteMode"
              type="button"
              :title="isDeleteMode ? '取消删除模式' : '删除图片'"
            >
              <el-icon :size="16">
                <Close v-if="isDeleteMode" />
                <Delete v-else />
              </el-icon>
            </button>
          </div>
          <div v-if="!isDeleteMode" style="display:flex;gap:8px;align-items:center;">
            <input id="edit-cover-input" type="file" accept="image/*" @change="onCoverChange" style="flex:1" />
            <button type="button" class="btn-primary btn-sm" :disabled="!coverFile || uploadingCover" @click="uploadCover" style="width:auto;padding:5px 14px;font-size:12px;">{{ uploadingCover ? '上传中' : '上传' }}</button>
          </div>
          <div v-if="coverUploadMsg==='success'" style="color:#67c23a;font-size:12px;">✓ 上传成功</div>
          <div v-else-if="coverUploadMsg" style="color:#f56c6c;font-size:12px;">✗ {{ coverUploadMsg }}</div>

          <div v-if="coverUrl" class="cover-image-wrapper" :class="{ deletable: isDeleteMode }" @click="isDeleteMode && confirmDeleteImage('cover', coverUrl)">
            <img :src="coverUrl" style="max-width:220px;border-radius:10px;" />
            <div v-if="isDeleteMode" class="delete-overlay">
              <el-icon :size="28" color="#fff"><DeleteFilled /></el-icon>
              <span>点击删除</span>
            </div>
          </div>
        </div>

        <!-- 详情图 — 带删除模式 -->
        <div class="image-section" :class="{ 'delete-mode': isDeleteMode }">
          <div class="section-header">
            <label style="margin-bottom:0;">详情图 ({{ detailImgUrls.length }})</label>
          </div>

          <div v-if="!isDeleteMode" style="display:flex;gap:8px;align-items:center;">
            <input id="edit-detail-input" type="file" accept="image/*" multiple @change="onDetailChange" style="flex:1" />
            <button type="button" class="btn-primary btn-sm" :disabled="!detailFiles.length || uploadingDetail" @click="uploadDetails" style="width:auto;padding:5px 14px;font-size:12px;">{{ uploadingDetail ? '上传中' : '上传' }}</button>
          </div>
          <div v-if="detailUploadMsg==='success'" style="color:#67c23a;font-size:12px;">✓ 上传成功</div>
          <div v-else-if="detailUploadMsg" style="color:#f56c6c;font-size:12px;">✗ {{ detailUploadMsg }}</div>

          <TransitionGroup v-if="detailImgUrls.length" name="image-list" tag="div" class="detail-images-grid">
            <div
              v-for="(u, i) in detailImgUrls"
              :key="u"
              class="detail-image-card"
              :class="{ deletable: isDeleteMode }"
              @click="isDeleteMode && confirmDeleteImage('detail', u, i)"
            >
              <img :src="u" />
              <div v-if="isDeleteMode" class="delete-overlay">
                <el-icon :size="22" color="#fff"><DeleteFilled /></el-icon>
              </div>
            </div>
          </TransitionGroup>

          <!-- 删除模式遮罩提示 -->
          <div v-if="isDeleteMode && detailImgUrls.length === 0" class="delete-empty-hint">
            暂无详情图可删除
          </div>
        </div>
      </fieldset>

      <!-- 开放日期（与创建页完全一致） -->
      <fieldset><legend>开放日期</legend>
        <OpenDateSelector
          v-model:all-time="isAllTimeOpen"
          v-model:dates="selectedDates"
        />
      </fieldset>

      <!-- 时间配置 -->
      <fieldset><legend>时间配置</legend>
        <label>工作起止
          <div style="display:flex;gap:8px;">
            <input type="time" v-model="baseStartTime" class="input-field" style="flex:1" />
            <span style="align-self:center">—</span>
            <input type="time" v-model="baseEndTime" class="input-field" style="flex:1" />
          </div>
        </label>
        <label>每单间隔休息 (分钟) <input type="number" v-model.number="intervalRestTime" min="0" max="120" class="input-field" style="width:100px" /></label>
        <label>固定休息时段</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="time" v-model="restStart" class="input-field" style="width:110px" />
          <span>—</span>
          <input type="time" v-model="restEnd" class="input-field" style="width:110px" />
          <button type="button" class="btn-secondary btn-sm" @click="addRestSlot" style="font-size:12px;">添加</button>
        </div>
        <div v-if="restSlots.length" style="margin-top:6px;">
          <span v-for="(r,i) in restSlots" :key="i" class="date-tag">{{ r.start_time }}–{{ r.end_time }}<button type="button" @click="removeRestSlot(i)" style="background:none;border:none;color:#f56c6c;cursor:pointer;">×</button></span>
        </div>
      </fieldset>

      <!-- 定价模式 -->
      <fieldset><legend>定价模式</legend>
        <label class="switch-label" style="display:block;margin-bottom:10px;">
          <input type="checkbox" v-model="isStyleEnabled" /> 使用预设（从预设库中勾选）
        </label>

        <template v-if="isStyleEnabled">
          <label>勾选预设</label>
          <div v-if="allStyles.length===0" style="font-size:12px;color:#999;">暂无可用预设</div>
          <div v-else style="display:flex;flex-wrap:wrap;gap:8px;">
            <label v-for="s in allStyles" :key="s.id" style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;">
              <input type="checkbox" :value="s.id" v-model="selectedStyleIds" /> {{ s.styleName }}
            </label>
          </div>
        </template>

        <template v-else>
          <!-- 妆娘模式：只显示单次价格，不显示定价下拉/套餐 -->
          <template v-if="isMakeupArtist">
            <label>单次价格 (元) <input type="number" v-model.number="singlePrice" min="0" step="0.01" class="input-field" style="width:160px" /></label>
          </template>
          <template v-else>
            <label>定价模式
              <select v-model="pricingModel" class="input-field" style="width:160px">
                <option value="single">仅单张</option>
                <option value="package">仅套餐</option>
                <option value="both">单张 + 套餐</option>
              </select>
            </label>
            <label v-if="pricingModel === 'single' || pricingModel === 'both'">单张价格 (元) <input type="number" v-model.number="singlePrice" min="0" step="0.01" class="input-field" style="width:160px" /></label>
            <label v-if="pricingModel === 'package' || pricingModel === 'both'">套餐价格 (元) <input type="number" v-model.number="packagePrice" min="0" step="0.01" class="input-field" style="width:160px" /></label>
            <label v-if="pricingModel === 'package' || pricingModel === 'both'">套餐包含次数 <input type="number" v-model.number="packageSessionCount" min="1" class="input-field" style="width:100px" /></label>
          </template>
        </template>

        <label class="switch-label" style="display:block;margin:10px 0;">
          <input type="checkbox" v-model="isExperienceEnabled" /> 开启新手加时模式
        </label>
        <label v-if="isExperienceEnabled">新人额外加时 (分钟) <input type="number" v-model.number="noviceSingleAddTime" min="0" max="120" class="input-field" style="width:100px" /></label>

        <label>单次服务耗时 (分钟) <input type="number" v-model.number="singleShotTime" min="1" class="input-field" style="width:100px" /></label>
        <label v-if="!isMakeupArtist && hasPackage">套餐服务耗时 (分钟) <input type="number" v-model.number="packageTime" min="1" class="input-field" style="width:100px" /></label>

        <label>定金比例
          <select v-model.number="depositRatio" class="input-field" style="width:140px">
            <option :value="0">0%</option><option :value="5">5%</option><option :value="10">10%</option><option :value="15">15%</option><option :value="20">20%</option><option :value="25">25%</option><option :value="30">30%</option><option :value="35">35%</option><option :value="40">40%</option><option :value="45">45%</option><option :value="50">50%</option>
          </select>
        </label>

        <label class="switch-label" style="display:block;margin:10px 0;">
          <input type="checkbox" v-model="addressRequired" /> 需要用户提供拍摄地址
        </label>

        <!-- 附加项目（非预设模式下可用） -->
        <template v-if="!isStyleEnabled">
          <hr style="border:none;border-top:1px solid var(--border-color, #F0EDE8);margin:16px 0;" />
          <ExtraItemsEditor v-model="extraItems" />
        </template>
      </fieldset>

      <div style="display:flex;gap:10px;margin-top:16px;">
        <button type="button" class="btn-secondary" @click="router.push('/admin/studios')" style="flex:1;">取消</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="handleSubmit" style="flex:2;">
          {{ saving ? '保存中...' : '保存修改' }}
        </button>
      </div>

      <!-- 删除确认弹窗 -->
      <el-dialog
        v-model="showDeleteConfirm"
        title="确认删除"
        width="360px"
        :close-on-click-modal="false"
        class="glass-dialog"
      >
        <div class="confirm-content">
          <el-icon :size="48" color="#f56c6c"><WarningFilled /></el-icon>
          <p>{{ deleteTarget?.type === 'cover' ? '封面图' : '详情图' }}将被永久删除，不可恢复</p>
        </div>
        <template #footer>
          <button class="btn-secondary btn-sm" @click="showDeleteConfirm = false" :disabled="isDeleting">取消</button>
          <button class="btn-danger btn-sm" @click="executeDelete" :disabled="isDeleting">
            {{ isDeleting ? '删除中...' : '确认删除' }}
          </button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<style scoped>
.edit-studio { min-height: 100vh; }
fieldset {
  border: 1px solid var(--border-color, #F0EDE8); border-radius: 14px; padding: 18px; margin-bottom: 16px;
}
legend { font-size: 15px; font-weight: 700; padding: 0 8px; color: var(--text-primary, #4A4A4A); }
label { display: block; margin-bottom: 8px; font-size: 13px; color: var(--text-primary, #4A4A4A); }
.input-field {
  padding: 8px 12px; border: 1px solid var(--border-color, #E8E5DF); border-radius: 10px;
  font-size: 13px; outline: none; margin-top: 2px; background: var(--bg-card, #fff);
}
.input-field:focus { border-color: #F4A460; box-shadow: 0 0 0 3px rgba(244,164,96,.12); }
.btn-primary { background: linear-gradient(135deg, #F4A460, #F7C57C); color: #fff; border: none; border-radius: 28px; padding: 10px 20px; cursor: pointer; font-weight: 600; }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-secondary { background: var(--bg-card, #fff); border: 1px solid var(--border-color, #E8E5DF); border-radius: 28px; padding: 10px 20px; cursor: pointer; color: var(--text-primary, #4A4A4A); }
.btn-sm { padding: 5px 12px; font-size: 12px; }
.date-tag {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 4px 10px; background: var(--color-peach-light, #FEF7EF); border-radius: 14px;
  font-size: 12px; color: #D4893E; font-weight: 500;
}
.switch-label { display: flex; align-items: center; gap: 6px; cursor: pointer; }

/* ═══════════════════════════════════════════
   图片删除模式样式
   ═══════════════════════════════════════════ */
.image-section {
  margin-bottom: 12px;
}
.section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.delete-trigger-btn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border-color, #E8E5DF);
  border-radius: 50%;
  background: var(--bg-card, #fff);
  cursor: pointer;
  color: var(--text-sub, #8b8d91);
  transition: all 0.25s ease;
}
.delete-trigger-btn:hover {
  border-color: #f56c6c;
  color: #f56c6c;
}
.delete-trigger-btn.is-active {
  background: #f56c6c;
  border-color: #f56c6c;
  color: #fff;
}

/* 删除模式脉动动画 */
@keyframes deletePulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.55);
    border-color: rgba(245, 108, 108, 0.35);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(245, 108, 108, 0);
    border-color: rgba(245, 108, 108, 0.85);
  }
}

.delete-mode .deletable {
  animation: deletePulse 1.8s ease-in-out infinite;
  cursor: pointer;
  transition: transform 0.2s ease;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}
.delete-mode .deletable:hover {
  transform: scale(0.95);
}
.delete-mode .deletable:active {
  transform: scale(0.9);
}

/* 封面图删除包装 */
.cover-image-wrapper {
  display: inline-block;
  margin-top: 8px;
  position: relative;
}
.cover-image-wrapper img {
  max-width: 220px; border-radius: 10px; display: block;
}

/* 详情图网格 */
.detail-images-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 8px;
}
.detail-image-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 1;
  background: linear-gradient(135deg, #FEFBF6, #F0F4F8);
}
.detail-image-card img {
  width: 100%; height: 100%; object-fit: cover;
}

/* 删除模式遮罩 */
.delete-overlay {
  position: absolute; inset: 0;
  background: rgba(245, 108, 108, 0.5);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  animation: fadeInScale 0.25s ease;
  border-radius: inherit;
}
.delete-overlay span {
  font-size: 12px; color: #fff; font-weight: 600;
}

.delete-empty-hint {
  text-align: center; padding: 20px;
  font-size: 13px; color: var(--text-sub, #999);
}

@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}

/* 删除后图片移除动画 */
.image-list-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
}
.image-list-leave-to {
  opacity: 0;
  transform: scale(0.7) translateY(10px);
}
.image-list-move {
  transition: transform 0.4s ease;
}

/* 确认弹窗 */
.confirm-content {
  text-align: center;
  padding: 16px 0;
}
.confirm-content p {
  margin: 12px 0 0;
  font-size: 14px;
  color: var(--text-primary, #4A4A4A);
}
.btn-danger {
  background: #f56c6c; color: #fff;
  border: none; border-radius: 28px; padding: 8px 20px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.2s ease;
}
.btn-danger:hover { background: #e04848; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

/* 移动端适配 */
@media (max-width: 768px) {
  .detail-images-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .cover-image-wrapper img { max-width: 160px; }
}

@media (max-width: 480px) {
  .detail-images-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .delete-overlay .el-icon { font-size: 20px !important; }
  .delete-overlay span { font-size: 11px; }
  .cover-image-wrapper img { max-width: 140px; }
}
</style>
