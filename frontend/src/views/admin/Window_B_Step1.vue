<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWizardBStore } from '@/stores/wizardB'
import { storage } from '@/utils/storage'
import { validateImageFile } from '@/utils/validateFile'

const router = useRouter()
const store = useWizardBStore()

const name = ref(store.title || '')
const description = ref(store.description || '')
const city = ref(store.city || '')
const coverUrl = ref(store.coverUrl || '')
const detailImgUrls = ref([...(store.detailImgUrls || [])])

const selectedDates = ref([...store.selectedDates])
const isAllTimeOpen = ref(store.isAllTimeOpen)

const uploadingCover = ref(false)
const uploadingDetail = ref(false)
const coverFile = ref(null)
const detailFiles = ref([])
const coverUploadMsg = ref('')
const detailUploadMsg = ref('')

function disabledDate(time) {
  return time.getTime() < Date.now() - 8.64e7
}

function uploadHeaders() {
  const token = storage.get('mzg_admin_token', '')
  const did = storage.get('mzg_device_id', '') || ('adm_' + Date.now())
  return {
    'x-device-id': did,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function onCoverFileChange(e) {
  const file = e.target.files[0] || null
  if (file) {
    const v = validateImageFile(file)
    if (!v.valid) { coverUploadMsg.value = v.error; return }
  }
  coverFile.value = file
}

async function uploadCover() {
  if (!coverFile.value) return
  coverUploadMsg.value = ''
  uploadingCover.value = true
  try {
    const fd = new FormData()
    fd.append('file', coverFile.value)
    fd.append('folder', 'covers')
    const res = await fetch('/api/upload/image', {
      method: 'POST', headers: uploadHeaders(), body: fd
    }).then(r => r.json())
    if (res.code === 0 || res.success) {
      coverUrl.value = (res.data && res.data.url) || res.url || ''
      coverFile.value = null
      coverUploadMsg.value = 'success'
      const input = document.getElementById('cover-file-input')
      if (input) input.value = ''
    } else {
      coverUploadMsg.value = res.message || '上传失败'
    }
  } catch (e) {
    coverUploadMsg.value = '网络错误，上传失败'
  }
  uploadingCover.value = false
}

function onDetailFileChange(e) {
  const files = Array.from(e.target.files || [])
  for (const f of files) {
    const v = validateImageFile(f)
    if (!v.valid) { detailUploadMsg.value = v.error; return }
  }
  detailFiles.value = files
}

async function uploadDetails() {
  if (!detailFiles.value.length) return
  detailUploadMsg.value = ''
  uploadingDetail.value = true
  try {
    const fd = new FormData()
    for (const f of detailFiles.value) fd.append('files', f)
    fd.append('folder', 'details')
    const res = await fetch('/api/upload/images', {
      method: 'POST', headers: uploadHeaders(), body: fd
    }).then(r => r.json())
    if (res.code === 0 || res.success) {
      const urls = (res.data && res.data.urls) || res.urls || []
      detailImgUrls.value = [...detailImgUrls.value, ...urls]
      detailFiles.value = []
      detailUploadMsg.value = 'success'
      const input = document.getElementById('detail-file-input')
      if (input) input.value = ''
    } else {
      detailUploadMsg.value = res.message || '上传失败'
    }
  } catch (e) {
    detailUploadMsg.value = '网络错误，上传失败'
  }
  uploadingDetail.value = false
}

function removeDetailImage(idx) {
  detailImgUrls.value.splice(idx, 1)
}

function moveDetailImage(idx, dir) {
  const newIdx = idx + dir
  if (newIdx < 0 || newIdx >= detailImgUrls.value.length) return
  const arr = [...detailImgUrls.value]
  ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
  detailImgUrls.value = arr
}

function goNext() {
  if (!name.value.trim()) return alert('请输入项目名称')
  if (!isAllTimeOpen.value && selectedDates.value.length === 0) return alert('请至少选择一个开放日期或开启全时段模式')

  store.title = name.value.trim()
  store.description = description.value.trim()
  store.city = city.value.trim()
  store.coverUrl = coverUrl.value
  store.detailImgUrls = [...detailImgUrls.value]
  store.selectedDates = [...selectedDates.value]
  store.isAllTimeOpen = isAllTimeOpen.value

  router.push('/admin/studio/create/step2')
}

function goBack() {
  router.push('/admin/studios')
}
</script>

<template>
  <div class="step-page fade-in-up">
    <h2 class="step-title">创建项目 — 第1步：基本信息</h2>

    <!-- 卡片：项目信息 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">项目信息</span>
      </template>

      <el-form-item label="项目名称" required>
        <el-input v-model="name" placeholder="例：汉服写真" maxlength="200" />
      </el-form-item>

      <el-form-item label="所在城市">
        <el-input v-model="city" placeholder="例：杭州" maxlength="50" />
      </el-form-item>

      <el-form-item label="项目描述">
        <el-input
          v-model="description"
          type="textarea"
          placeholder="介绍服务内容、特色等"
          :rows="4"
        />
      </el-form-item>
    </el-card>

    <!-- 卡片：图片素材 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">图片素材</span>
      </template>

      <el-form-item label="封面图">
        <div class="upload-row">
          <input id="cover-file-input" type="file" accept="image/*" @change="onCoverFileChange" style="flex:1;min-width:200px;" />
          <el-button type="primary" size="small" @click="uploadCover" :disabled="!coverFile || uploadingCover" :loading="uploadingCover">
            上传
          </el-button>
        </div>
        <div v-if="coverFile" class="upload-hint">已选择: {{ coverFile.name }}</div>
        <div v-if="coverUploadMsg === 'success'" class="msg-success">封面上传成功</div>
        <div v-else-if="coverUploadMsg" class="msg-error">{{ coverUploadMsg }}</div>
        <img v-if="coverUrl" :src="coverUrl" class="cover-preview" />
      </el-form-item>

      <el-divider />

      <el-form-item label="详情图（可多选）">
        <div class="upload-row">
          <input id="detail-file-input" type="file" accept="image/*" multiple @change="onDetailFileChange" style="flex:1;min-width:200px;" />
          <el-button type="primary" size="small" @click="uploadDetails" :disabled="!detailFiles.length || uploadingDetail" :loading="uploadingDetail">
            上传
          </el-button>
        </div>
        <div v-if="detailFiles.length" class="upload-hint">已选择 {{ detailFiles.length }} 个文件</div>
        <div v-if="detailUploadMsg === 'success'" class="msg-success">详情图上传成功</div>
        <div v-else-if="detailUploadMsg" class="msg-error">{{ detailUploadMsg }}</div>
        <div class="detail-grid">
          <div v-for="(url, idx) in detailImgUrls" :key="idx" class="detail-item">
            <img :src="url" />
            <button class="detail-del" @click="removeDetailImage(idx)">&times;</button>
            <div class="detail-arrows">
              <button @click="moveDetailImage(idx, -1)" :disabled="idx===0">↑</button>
              <button @click="moveDetailImage(idx, 1)" :disabled="idx===detailImgUrls.length-1">↓</button>
            </div>
          </div>
        </div>
      </el-form-item>
    </el-card>

    <!-- 卡片：开放日期 — 全时段开关 -->
    <el-card shadow="never" class="step-card">
      <template #header>
        <span class="card-header-title">开放日期</span>
      </template>

      <el-form-item label="全时段">
        <div class="all-time-row">
          <el-switch v-model="isAllTimeOpen" active-text="开启" inactive-text="关闭" />
          <el-tooltip content="开启后该工作室对所有日期开放接单，无需手动选择具体日期" placement="top">
            <span class="tooltip-dot">?</span>
          </el-tooltip>
        </div>
      </el-form-item>

      <!-- 全时段开启 -->
      <div v-if="isAllTimeOpen" class="all-time-notice">
        <span class="notice-dot">&#10003;</span>
        全时段模式已开启，客户可在任意日期预约
      </div>

      <!-- 全时段关闭：日期多选 -->
      <el-form-item v-else label="选择可接单日期" required>
        <div class="date-picker-area">
          <el-date-picker
            v-model="selectedDates"
            type="dates"
            value-format="YYYY-MM-DD"
            placeholder="点击选择可接单日期"
            :disabled-date="disabledDate"
            style="width:100%"
          />
          <div v-if="selectedDates.length > 0" class="date-tags">
            <el-tag
              v-for="(d, idx) in selectedDates"
              :key="d"
              closable
              type="info"
              size="small"
              @close="selectedDates.splice(idx, 1)"
            >
              {{ d }}
            </el-tag>
          </div>
          <span class="field-hint">已选 {{ selectedDates.length }} 天</span>
        </div>
      </el-form-item>
    </el-card>

    <!-- 底部操作 -->
    <div class="step-footer">
      <el-button @click="goBack" size="large">取消</el-button>
      <el-button type="primary" @click="goNext" size="large">下一步</el-button>
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
  color: #4A4A4A;
  margin-bottom: 20px;
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

/* 表单项 */
:deep(.el-form-item) {
  margin-bottom: 18px;
  display: flex;
  align-items: flex-start;
}
:deep(.el-form-item__label) {
  font-weight: 600;
  color: #4A4A4A;
  min-width: 110px;
}

/* 全时段 */
.all-time-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tooltip-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #F4F2EE;
  color: #B0B0B0;
  font-size: 11px;
  font-weight: 700;
  cursor: help;
}
.all-time-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: #EDF6F0;
  border: 1px solid rgba(168,216,185,0.30);
  border-radius: 10px;
  color: #5A8A6A;
  font-size: 14px;
  font-weight: 500;
  margin-top: 8px;
}
.notice-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: #A8D8B9;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

/* 日期 */
.date-picker-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.date-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.field-hint {
  font-size: 12px;
  color: #B0B0B0;
}

/* 上传 */
.upload-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.upload-hint {
  font-size: 12px;
  color: #B8933E;
  margin-top: 4px;
}
.msg-success {
  font-size: 12px;
  color: #5A8A6A;
  margin-top: 4px;
}
.msg-error {
  font-size: 12px;
  color: #EFA8A8;
  margin-top: 4px;
}
.cover-preview {
  max-width: 200px;
  display: block;
  margin-top: 10px;
  border-radius: 10px;
  border: 1px solid #F0EDE8;
}

/* 详情图网格 */
.detail-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.detail-item {
  position: relative;
  display: inline-block;
}
.detail-item img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #F0EDE8;
}
.detail-del {
  position: absolute;
  top: -6px; right: -6px;
  background: #EFA8A8;
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 20px; height: 20px;
  font-size: 12px;
  cursor: pointer;
  line-height: 1;
}
.detail-arrows {
  display: flex;
  justify-content: center;
  gap: 2px;
  margin-top: 2px;
}
.detail-arrows button {
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid #E8E5DF;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}
.detail-arrows button:disabled {
  opacity: .3;
  cursor: not-allowed;
}

/* 底部操作 */
.step-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}
</style>
