<template>
  <div class="styles-view fade-in-up">
    <div class="section-box">
      <div class="section-header">
        <h3><i class="fa-solid fa-palette"></i> 预设管理</h3>
        <el-button type="primary" size="small" @click="openAdd">新增预设</el-button>
      </div>

      <div v-if="store.loading" class="loading-wrap">加载中...</div>
      <template v-else>
        <div v-for="item in store.styles" :key="item.id" class="style-card">
          <img v-if="item.styleCoverUrl" :src="item.styleCoverUrl" class="style-cover" />
          <div class="style-info">
            <strong>{{ item.styleName }}</strong>
            <span class="style-price">单张 ¥{{ item.singlePrice }}</span>
            <span v-if="item.hasPackage" class="style-package">套餐 ¥{{ item.packagePrice }}</span>
          </div>
          <div class="style-actions">
            <el-button size="small" @click="openEdit(item)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(item.id)">删除</el-button>
          </div>
        </div>
        <div v-if="!store.styles.length" class="empty-state">暂无预设，点击右上角新增</div>
      </template>
    </div>

    <!-- 全屏新增/编辑弹窗（Teleport 到 body，脱离容器限制） -->
    <Teleport to="body">
      <el-dialog
        v-model="dialogVisible"
        :title="editingId ? '编辑预设' : '新增预设'"
        fullscreen
        destroy-on-close
        :show-close="true"
        :before-close="handleBeforeClose"
    >
      <div class="dialog-body">
        <div class="dialog-inner">

          <!-- 卡片：基本信息 -->
          <el-card shadow="never" class="form-card">
            <template #header>
              <span class="card-hd">基本信息</span>
            </template>

            <el-form-item label="预设名称" required>
              <el-input v-model="form.styleName" placeholder="如：日系清新" maxlength="100" />
            </el-form-item>

            <el-form-item label="预设描述">
              <el-input
                v-model="form.description"
                type="textarea"
                placeholder="描述风格特点、适合场景等"
                :rows="3"
              />
            </el-form-item>

            <el-form-item label="示意图">
              <div class="upload-row">
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  @change="onFileChange"
                  class="file-picker"
                />
                <el-button
                  type="primary"
                  size="small"
                  :loading="uploading"
                  :disabled="!selectedFile"
                  @click="uploadCover"
                >
                  {{ uploading ? '上传中...' : '上传' }}
                </el-button>
              </div>
              <div v-if="selectedFile && !uploadMsg" class="file-hint">
                已选择：{{ selectedFile.name }}（请点击上传）
              </div>
              <div v-if="uploadMsg === 'success'" class="upload-ok">✓ 上传成功</div>
              <div v-else-if="uploadMsg" class="upload-err">✗ {{ uploadMsg }}</div>
              <img
                v-if="form.styleCoverUrl"
                :src="form.styleCoverUrl"
                class="cover-preview"
              />
              <el-input
                v-model="form.styleCoverUrl"
                placeholder="或直接粘贴图片URL"
                size="small"
                style="margin-top:8px"
              />
            </el-form-item>
          </el-card>

          <!-- 卡片：定价与时长 -->
          <el-card shadow="never" class="form-card">
            <template #header>
              <span class="card-hd">定价与时长</span>
            </template>

            <el-form-item label="单张价格" required>
              <el-input-number v-model="form.singlePrice" :min="0" :precision="2" :step="0.01" />
              <span class="unit">元 / 张</span>
            </el-form-item>

            <el-form-item label="基础拍摄时长">
              <el-input-number v-model="form.base_duration" :min="1" :max="480" />
              <span class="unit">分钟</span>
            </el-form-item>

            <el-divider />

            <!-- ★ 多套餐动态配置 -->
            <div class="packages-section">
              <div class="packages-section-hd">
                <span class="packages-section-title">套餐配置</span>
                <span class="packages-section-hint">{{ form.packages.length }} 个套餐</span>
              </div>

              <TransitionGroup name="pkg-list" tag="div" class="pkg-list">
                <div v-for="(pkg, idx) in form.packages" :key="idx" class="pkg-card">
                  <!-- 卡片头：编号 + 删除 -->
                  <div class="pkg-card-bar">
                    <span class="pkg-card-num">套餐 {{ idx + 1 }}</span>
                    <el-button size="small" class="pkg-del-btn" @click="removePackage(idx)">
                      🗑️ 删除此套餐
                    </el-button>
                  </div>

                  <!-- 字段区 -->
                  <div class="pkg-card-body">
                    <el-form-item label="套餐名称" :label-width="80">
                      <el-input v-model="pkg.name" placeholder="如：10张精修套餐" maxlength="64" />
                    </el-form-item>

                    <el-form-item label="包含张数" :label-width="80">
                      <el-input-number v-model="pkg.photoCount" :min="1" :max="99" />
                      <span class="unit">张</span>
                    </el-form-item>

                    <el-form-item label="固定总价" :label-width="80">
                      <el-input-number v-model="pkg.totalPrice" :min="0" :precision="2" :step="0.01" />
                      <span class="unit">元</span>
                    </el-form-item>

                    <el-form-item label="固定耗时" :label-width="80">
                      <el-input-number v-model="pkg.fixedDuration" :min="1" :max="480" :step="5" />
                      <span class="unit">分钟</span>
                    </el-form-item>

                    <el-form-item label="套餐描述" :label-width="80">
                      <el-input v-model="pkg.description" placeholder="如：含精修+底片全送" maxlength="256" />
                    </el-form-item>
                  </div>
                </div>
              </TransitionGroup>

              <el-button class="pkg-add-btn" @click="addPackage">
                ➕ 添加新套餐
              </el-button>
            </div>
          </el-card>

          <!-- 卡片：附加项目 -->
          <el-card shadow="never" class="form-card">
            <template #header>
              <span class="card-hd">附加项目</span>
            </template>

            <div class="addon-section">
              <div class="packages-section-hd">
                <span class="packages-section-title">附加项目</span>
                <span class="packages-section-hint">{{ form.additionalItems.length }} 个项目</span>
              </div>

              <TransitionGroup name="pkg-list" tag="div" class="pkg-list">
                <div v-for="(item, idx) in form.additionalItems" :key="idx" class="pkg-card">
                  <div class="pkg-card-bar">
                    <span class="pkg-card-num">项目 {{ idx + 1 }}</span>
                    <el-button size="small" class="pkg-del-btn" @click="removeAdditionalItem(idx)">
                      删除
                    </el-button>
                  </div>
                  <div class="pkg-card-body">
                    <el-form-item label="项目名称" :label-width="80">
                      <el-input v-model="item.name" placeholder="如：妆造加急" maxlength="64" />
                    </el-form-item>
                    <el-form-item label="金额" :label-width="80">
                      <el-input-number v-model="item.price" :min="0" :precision="2" :step="1" />
                      <span class="unit">元</span>
                    </el-form-item>
                    <el-form-item label="计费单位" :label-width="80">
                      <el-select v-model="item.unit" style="width:160px;">
                        <el-option label="元/次" value="per_time" />
                        <el-option label="元/张" value="per_photo" />
                        <el-option label="元/个" value="per_item" />
                      </el-select>
                    </el-form-item>
                  </div>
                </div>
              </TransitionGroup>

              <el-button class="pkg-add-btn" @click="addAdditionalItem">
                + 新增附加项目
              </el-button>
            </div>
          </el-card>

          <!-- 卡片：预览图 -->
          <el-card shadow="never" class="form-card">
            <template #header>
              <span class="card-hd">预览图</span>
            </template>

            <el-form-item label="预览图URL">
              <div class="preview-url-row">
                <el-input
                  v-model="previewInput"
                  placeholder="粘贴图片 URL，按回车添加"
                  size="small"
                  @keyup.enter="addPreviewUrl"
                />
                <el-button size="small" @click="addPreviewUrl">添加</el-button>
              </div>
            </el-form-item>
            <div v-if="form.preview_urls.length > 0" class="preview-list">
              <el-tag
                v-for="(url, idx) in form.preview_urls"
                :key="url"
                closable
                size="small"
                @close="form.preview_urls.splice(idx, 1)"
              >
                {{ url }}
              </el-tag>
            </div>
          </el-card>

        </div>
      </div>

      <template #footer>
        <el-button @click="handleCancel" size="large">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave" size="large">保存</el-button>
      </template>
    </el-dialog>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useStyleStore } from '@/stores/style'
import { storage } from '@/utils/storage'
import { ElMessageBox } from 'element-plus'
import { validateImageFile } from '@/utils/validateFile'

const store = useStyleStore()
const mId = ref(storage.get('mzg_admin_mid', ''))

const dialogVisible = ref(false)
const editingId = ref(null)
const saving = ref(false)
const form = reactive({
  styleName: '', description: '', styleCoverUrl: '',
  preview_urls: [],
  singlePrice: 0, base_duration: 5,
  packages: [],
  additionalItems: [],
})

const previewInput = ref('')

function addPreviewUrl() {
  const url = previewInput.value.trim()
  if (url && !form.preview_urls.includes(url)) {
    form.preview_urls.push(url)
  }
  previewInput.value = ''
}

function addPackage() {
  form.packages.push({ name: '', photoCount: 10, totalPrice: 0, fixedDuration: 120, description: '' })
}
function removePackage(idx) {
  form.packages.splice(idx, 1)
}

function addAdditionalItem() {
  form.additionalItems.push({ name: '', price: 0, unit: 'per_time' })
}
function removeAdditionalItem(idx) {
  form.additionalItems.splice(idx, 1)
}

// ── 封面图片上传 ──
const fileInput = ref(null)
const selectedFile = ref(null)
const uploading = ref(false)
const uploadMsg = ref('')


function onFileChange(e) {
  const file = e.target.files[0] || null
  uploadMsg.value = ''
  if (file) {
    const v = validateImageFile(file)
    if (!v.valid) { uploadMsg.value = v.error; return }
  }
  selectedFile.value = file
}

async function uploadCover() {
  if (!selectedFile.value) return
  uploading.value = true
  uploadMsg.value = ''
  try {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    fd.append('folder', 'styles')
    const token = storage.get('mzg_admin_token', '')
    const deviceId = storage.get('mzg_device_id', '') || ('adm_' + Date.now())
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: { 'x-device-id': deviceId, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: fd,
    }).then(r => r.json())
    if (res.success || res.code === 0) {
      form.styleCoverUrl = (res.data && res.data.url) || res.url || ''
      if (!form.styleCoverUrl) { uploadMsg.value = '上传成功但未获取到图片地址'; return }
      uploadMsg.value = 'success'
      selectedFile.value = null
      if (fileInput.value) fileInput.value.value = ''
    } else {
      uploadMsg.value = res.message || '上传失败'
    }
  } catch (e) {
    uploadMsg.value = e?.message || '网络错误，上传失败'
  } finally {
    uploading.value = false
  }
}

// ── 关闭确认 ──
function hasFormData() {
  return form.styleName.trim() || form.styleCoverUrl || form.description.trim() ||
    form.preview_urls.length > 0 || form.singlePrice > 0
}

async function handleBeforeClose(done) {
  if (hasFormData()) {
    try {
      await ElMessageBox.confirm('关闭将丢失已填写内容，确认关闭？', '提示', { type: 'warning', confirmButtonText: '确认关闭', cancelButtonText: '继续编辑' })
    } catch {
      return
    }
  }
  done()
}

function handleCancel() {
  dialogVisible.value = false
}

// ── CRUD ──
let _abort = null
onMounted(() => {
  if (mId.value) store.fetchStyles(mId.value)
})
onBeforeUnmount(() => {
  if (_abort) _abort.abort()
})

const defaultForm = () => ({
  styleName: '', description: '', styleCoverUrl: '',
  preview_urls: [],
  singlePrice: 0, base_duration: 5,
  packages: [],
  additionalItems: [],
})

function openAdd() {
  editingId.value = null
  Object.assign(form, defaultForm())
  selectedFile.value = null
  uploadMsg.value = ''
  previewInput.value = ''
  if (fileInput.value) fileInput.value.value = ''
  dialogVisible.value = true
}

function openEdit(item) {
  editingId.value = item.id
  // 从 API 返回的 packages 数组回显，若无则用空数组
  const pkgs = (item.packages && Array.isArray(item.packages))
    ? item.packages.map(p => ({ ...p }))
    : []
  const addons = (item.additionalItems && Array.isArray(item.additionalItems))
    ? item.additionalItems.map(a => ({ ...a }))
    : []
  Object.assign(form, {
    styleName: item.styleName || '',
    description: item.description || '',
    styleCoverUrl: item.styleCoverUrl || '',
    preview_urls: (item.preview_urls && Array.isArray(item.preview_urls)) ? [...item.preview_urls] : [],
    singlePrice: item.singlePrice || 0,
    base_duration: item.base_duration || 5,
    packages: pkgs,
    additionalItems: addons,
  })
  selectedFile.value = null
  uploadMsg.value = ''
  previewInput.value = ''
  if (fileInput.value) fileInput.value.value = ''
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.styleName.trim()) return
  saving.value = true
  try {
    // 构建 packages 数组，过滤空项
    const packages = form.packages
      .filter(p => p.name && p.name.trim() && p.totalPrice > 0)
      .map(p => ({
        name: p.name.trim(),
        photoCount: Number(p.photoCount) || 1,
        totalPrice: Number(p.totalPrice) || 0,
        fixedDuration: Number(p.fixedDuration) || 5,
        description: (p.description || '').trim(),
      }))
    const additionalItems = form.additionalItems
      .filter(a => a.name && a.name.trim() && a.price > 0)
      .map(a => ({
        name: a.name.trim(),
        price: Number(a.price) || 0,
        unit: a.unit || 'per_time',
      }))
    const data = {
      ...form,
      mId: mId.value,
      packages,
      additionalItems,
    }
    if (editingId.value) {
      data.id = editingId.value
      await store.update(data)
    } else {
      await store.create(data)
    }
    dialogVisible.value = false
  } finally {
    saving.value = false
  }
}

async function handleDelete(id) {
  await ElMessageBox.confirm('确定删除该预设？', '提示', { type: 'warning' })
  await store.remove({ id, mId: mId.value })
}
</script>

<style scoped>
.styles-view { max-width: 900px; margin: 0 auto; }
.section-box { background: var(--bg-card, #fff); border-radius: 14px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,.05); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header h3 { font-size: 16px; display: flex; align-items: center; gap: 6px; }
.style-card { display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 14px; margin-bottom: 8px; border: 1px solid var(--border-color, #F0EDE8); background: var(--bg-card, #fff); }
.style-cover { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
.style-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.style-price { color: #5a7a65; font-weight: 600; font-size: 13px; }
.style-package { color: #8a7040; font-size: 13px; }
.style-actions { display: flex; gap: 6px; }
.loading-wrap, .empty-state { text-align: center; padding: 40px; color: var(--text-secondary, #8E8E8E); }

/* ── 全屏弹窗 ── */
.dialog-body {
  display: flex;
  justify-content: center;
  background: var(--bg-page, #F9F8F6);
  min-height: 100%;
  padding: 24px;
}
.dialog-inner {
  width: 100%;
  max-width: 780px;
}

.form-card {
  margin-bottom: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #F0EDE8);
}
.form-card :deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #F0EDE8);
  background: var(--bg-table-stripe, #FDFBF7);
  border-radius: 12px 12px 0 0;
}
.form-card :deep(.el-card__body) {
  padding: 20px;
}
.card-hd {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #4A4A4A);
}

:deep(.el-form-item) {
  margin-bottom: 18px;
}
:deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--text-primary, #4A4A4A);
  min-width: 120px;
}

.unit {
  margin-left: 8px;
  font-size: 13px;
  color: var(--text-secondary, #8E8E8E);
}

/* 上传 */
.upload-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.file-picker { flex: 1; min-width: 180px; font-size: 12px; }
.file-hint { font-size: 12px; color: #B8933E; margin-top: 4px; }
.upload-ok { font-size: 12px; color: #5A8A6A; margin-top: 4px; }
.upload-err { font-size: 12px; color: #EFA8A8; margin-top: 4px; }
.cover-preview {
  max-width: 240px; max-height: 160px; display: block;
  margin-top: 8px; border-radius: 10px; object-fit: cover;
  border: 1px solid var(--border-color, #F0EDE8);
}

/* ── 套餐配置区域 ── */
.packages-section {
  margin-top: 8px;
}
.packages-section-hd {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 12px;
}
.packages-section-title {
  font-size: 14px; font-weight: 700; color: var(--text-primary, #4A4A4A);
}
.packages-section-hint {
  font-size: 12px; color: #B0B0B0;
}

/* 套餐卡片 */
.pkg-list {
  display: flex; flex-direction: column; gap: 12px;
}
.pkg-card {
  border: 1px solid var(--border-color, #F0EDE8); border-radius: 12px;
  background: var(--bg-table-stripe, #FAFAF8); overflow: hidden;
  transition: all 0.3s ease;
}
.pkg-card:hover {
  border-color: #E8E0D8; box-shadow: 0 2px 8px rgba(0,0,0,.04);
}
.pkg-card-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 16px;
  background: linear-gradient(135deg, #FDFBF7, #F9F5F0);
  border-bottom: 1px solid var(--border-color, #F0EDE8);
}
.pkg-card-num {
  font-size: 12px; font-weight: 700; color: #8a7040;
  letter-spacing: 0.5px; text-transform: uppercase;
}
.pkg-del-btn {
  font-size: 12px !important; padding: 4px 12px !important;
}

.pkg-card-body {
  padding: 8px 16px 14px;
}
.pkg-card-body :deep(.el-form-item) {
  margin-bottom: 12px;
}
.pkg-card-body :deep(.el-form-item__label) {
  font-size: 12px; color: var(--text-secondary, #8E8E8E); font-weight: 600;
}

/* 添加按钮 */
.pkg-add-btn {
  width: 100%; margin-top: 10px;
  border: 2px dashed #E0D8CC !important;
  background: transparent !important;
  color: #8a7040 !important;
  font-size: 14px !important; font-weight: 600 !important;
  padding: 12px !important; border-radius: 12px !important;
  transition: all 0.2s !important;
}
.pkg-add-btn:hover {
  border-color: #D4893E !important;
  background: var(--color-peach-light, #FEF7EF) !important;
  color: var(--color-primary-dark, #D4893E) !important;
}

/* 卡片列表过渡动画 */
.pkg-list-enter-active,
.pkg-list-leave-active {
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.pkg-list-enter-from {
  opacity: 0; transform: translateY(-12px) scale(0.96);
}
.pkg-list-leave-to {
  opacity: 0; transform: translateX(30px) scale(0.96);
}
.pkg-list-move {
  transition: transform 0.3s ease;
}

/* 预览图 */
.preview-url-row {
  display: flex;
  gap: 8px;
}
.preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.preview-list .el-tag {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
