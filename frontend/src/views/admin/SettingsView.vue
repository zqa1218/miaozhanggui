<script setup>
import { ref, reactive, onMounted } from 'vue'
import { adminApi } from '@/api/adminApi'
import { validateImageFile } from '@/utils/validateFile'

const form = ref({ shopName: '', announcement: '', qrCodeUrl: '', alipayQrUrl: '', wechatQrUrl: '', paymentQrCode: '', declarationEnabled: false, declarationContent: '' })
const saving = ref(false)
const msg = ref('')

// ── 项目列表（供声明指定项目使用） ──
const studioList = ref([])

async function fetchStudios() {
  try {
    const res = await adminApi.getStudios()
    if (res && Array.isArray(res.data)) studioList.value = res.data
  } catch {}
}

// ── 声明编辑 ──
const declarationLines = ref([])
const MAX_DECLARATION_LINES = 10

function parseDeclarationContent(raw) {
  if (!raw || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map(item => ({
        text: typeof item.text === 'string' ? item.text : '',
        studioIds: Array.isArray(item.studioIds) ? item.studioIds : [],
      }))
    }
  } catch {}
  return raw.split('\n')
    .filter(line => line.trim())
    .map(line => ({
      text: line.replace(/^\d+\.\s*/, '').trim(),
      studioIds: [],
    }))
}

function initDeclarationLines() {
  const items = parseDeclarationContent(form.value.declarationContent || '')
  declarationLines.value = items.length > 0 ? items : [{ text: '', studioIds: [] }]
}

function addDeclarationLine() {
  if (declarationLines.value.length >= MAX_DECLARATION_LINES) return
  declarationLines.value.push({ text: '', studioIds: [] })
}

function removeDeclarationLine(idx) {
  if (declarationLines.value.length <= 1) return
  declarationLines.value.splice(idx, 1)
}

function syncDeclarationContent() {
  const filled = declarationLines.value.filter(line => line.text.trim() !== '')
  form.value.declarationContent = filled.length > 0 ? JSON.stringify(filled) : ''
}

function getSelectedNames(studioIds) {
  if (!studioIds || studioIds.length === 0) return ''
  return studioList.value
    .filter(s => studioIds.includes(s.id))
    .map(s => s.title)
    .join('、')
}

// ── 二维码文件 & 上传状态 ──
const qrFiles = reactive({ alipayQrUrl: null, wechatQrUrl: null, paymentQrCode: null })
const qrUploading = reactive({ alipayQrUrl: false, wechatQrUrl: false, paymentQrCode: false })
const qrMsg = reactive({ alipayQrUrl: '', wechatQrUrl: '', paymentQrCode: '' })

onMounted(async () => {
  const res = await adminApi.getSettings()
  if (res.success && res.data) form.value = { ...form.value, ...res.data }
  initDeclarationLines()
  fetchStudios()
})

function onFileChange(e, field) {
  const file = e.target.files[0] || null
  qrMsg[field] = ''
  if (file) {
    const v = validateImageFile(file, { maxSize: 5 * 1024 * 1024 })
    if (!v.valid) {
      qrMsg[field] = v.error
      qrFiles[field] = null
      const el = document.getElementById('qr-file-' + field)
      if (el) el.value = ''
      return
    }
  }
  qrFiles[field] = file
}

async function uploadQr(field) {
  const file = qrFiles[field]
  if (!file) return
  qrUploading[field] = true
  qrMsg[field] = ''
  try {
    const res = await adminApi.uploadImage(file, 'qrcodes')
    if (res.success || res.code === 0) {
      const url = (res.data && res.data.url) || res.url || ''
      if (!url) { qrMsg[field] = '上传成功但未获取到图片地址'; return }
      form.value[field] = url
      qrFiles[field] = null
      qrMsg[field] = 'success'
      const el = document.getElementById('qr-file-' + field)
      if (el) el.value = ''
      await save()
    } else {
      qrMsg[field] = res.message || '上传失败'
    }
  } catch (e) {
    qrMsg[field] = e?.message || '网络错误，上传失败'
  } finally {
    qrUploading[field] = false
  }
}

async function save() {
  saving.value = true
  msg.value = ''
  syncDeclarationContent()
  try {
    const res = await adminApi.saveSettings(form.value)
    if (res.success || res.code === 0) msg.value = '设置已保存'
    else msg.value = res.message || '保存失败'
  } catch (e) {
    msg.value = '网络错误，保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fade-in-up">
    <h2 style="margin:12px 0;">店铺设置</h2>
    <div v-if="msg" class="success">{{ msg }}</div>

    <div class="section">
      <div class="input-row"><label>店铺名称</label><input v-model="form.shopName" /></div>
      <div class="input-row"><label>公告</label><textarea v-model="form.announcement" rows="2"></textarea></div>
    </div>

    <!-- 弹窗声明 -->
    <div class="section">
      <div class="section-title">弹窗声明</div>
      <div class="toggle-row">
        <span class="toggle-label">弹窗声明</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="form.declarationEnabled" @change="initDeclarationLines" />
          <span class="toggle-track"></span>
        </label>
      </div>
      <p class="toggle-hint">开启后用户付款前将强制显示弹窗声明</p>

      <template v-if="form.declarationEnabled">
        <div class="declaration-editor">
          <label class="editor-label">声明内容（每行自动编号，最多 {{ MAX_DECLARATION_LINES }} 条）</label>
          <div v-for="(line, i) in declarationLines" :key="i" class="editor-row">
            <div class="editor-row-top">
              <span class="editor-num">{{ i + 1 }}.</span>
              <input
                v-model="line.text"
                class="editor-input"
                :placeholder="`第 ${i + 1} 条声明内容`"
                maxlength="256"
              />
              <button
                v-if="declarationLines.length > 1"
                class="btn-row-remove"
                title="删除此行"
                @click="removeDeclarationLine(i)"
              >&times;</button>
            </div>
            <div class="editor-row-bottom">
              <span class="project-label">指定项目：</span>
              <div class="project-selector-area">
                <el-select
                  v-model="line.studioIds"
                  multiple
                  filterable
                  clearable
                  collapse-tags
                  collapse-tags-tooltip
                  placeholder="全部项目（不选则适用于所有）"
                  class="project-select"
                >
                  <el-option
                    v-for="s in studioList"
                    :key="s.id"
                    :label="s.title"
                    :value="s.id"
                  />
                </el-select>
                <span class="project-hint" :class="{ dim: line.studioIds.length > 0 }">
                  {{ line.studioIds.length === 0 ? '全部项目' : getSelectedNames(line.studioIds) || '已选' }}
                </span>
              </div>
            </div>
          </div>
          <div class="editor-actions">
            <button
              class="btn-editor-add"
              :disabled="declarationLines.length >= MAX_DECLARATION_LINES"
              @click="addDeclarationLine"
            >+ 添加一条</button>
          </div>
        </div>
      </template>
    </div>

    <!-- 收款码等... -->
    <div class="section">
      <div class="section-title">收款码配置</div>
      <div class="input-row">
        <label>支付宝码</label>
        <div class="qr-upload-row">
          <input v-model="form.alipayQrUrl" placeholder="URL 或上传" class="flex-1" />
          <input id="qr-file-alipayQrUrl" type="file" accept="image/*" @change="onFileChange($event, 'alipayQrUrl')" class="file-input" />
          <button class="btn-upload" :disabled="!qrFiles.alipayQrUrl || qrUploading.alipayQrUrl" @click="uploadQr('alipayQrUrl')">
            {{ qrUploading.alipayQrUrl ? '上传中' : '上传' }}
          </button>
        </div>
        <div v-if="qrMsg.alipayQrUrl === 'success'" class="upload-ok">上传成功</div>
        <div v-else-if="qrMsg.alipayQrUrl" class="upload-fail">{{ qrMsg.alipayQrUrl }}</div>
      </div>
      <img v-if="form.alipayQrUrl" :src="form.alipayQrUrl" class="qr-preview" />
    </div>

    <div class="section" style="margin-top:12px;">
      <div class="input-row">
        <label>微信码</label>
        <div class="qr-upload-row">
          <input v-model="form.wechatQrUrl" placeholder="URL 或上传" class="flex-1" />
          <input id="qr-file-wechatQrUrl" type="file" accept="image/*" @change="onFileChange($event, 'wechatQrUrl')" class="file-input" />
          <button class="btn-upload" :disabled="!qrFiles.wechatQrUrl || qrUploading.wechatQrUrl" @click="uploadQr('wechatQrUrl')">
            {{ qrUploading.wechatQrUrl ? '上传中' : '上传' }}
          </button>
        </div>
        <div v-if="qrMsg.wechatQrUrl === 'success'" class="upload-ok">上传成功</div>
        <div v-else-if="qrMsg.wechatQrUrl" class="upload-fail">{{ qrMsg.wechatQrUrl }}</div>
      </div>
      <img v-if="form.wechatQrUrl" :src="form.wechatQrUrl" class="qr-preview" />
    </div>

    <div class="section" style="margin-top:12px;">
      <div class="section-title">统一收款码</div>
      <div class="input-row">
        <label>收款二维码（用于客户端预约完成后展示）</label>
        <div class="qr-upload-row">
          <input v-model="form.paymentQrCode" placeholder="URL 或上传" class="flex-1" />
          <input id="qr-file-paymentQrCode" type="file" accept="image/*" @change="onFileChange($event, 'paymentQrCode')" class="file-input" />
          <button class="btn-upload" :disabled="!qrFiles.paymentQrCode || qrUploading.paymentQrCode" @click="uploadQr('paymentQrCode')">
            {{ qrUploading.paymentQrCode ? '上传中' : '上传' }}
          </button>
        </div>
        <div v-if="qrMsg.paymentQrCode === 'success'" class="upload-ok">上传成功</div>
        <div v-else-if="qrMsg.paymentQrCode" class="upload-fail">{{ qrMsg.paymentQrCode }}</div>
      </div>
      <img v-if="form.paymentQrCode" :src="form.paymentQrCode" class="qr-preview-lg" />
      <button v-if="form.paymentQrCode" class="btn-link" @click="form.paymentQrCode = ''" style="margin-top:4px;">删除</button>
    </div>

    <div style="padding:10px 14px;">
      <button class="btn-primary" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存设置' }}</button>
    </div>
  </div>
</template>

<style scoped>
.success { color: #5A8A6A; font-size: 13px; margin-bottom: 8px; }
.section {
  background: #fff; border-radius: 14px; padding: 16px; margin-bottom: 12px;
  border: 1px solid #F0EDE8; box-shadow: 0 1px 4px rgba(0,0,0,.02);
}
.section-title { font-size: 14px; font-weight: 700; color: #4A4A4A; margin-bottom: 10px; }
.input-row { margin-bottom: 10px; }
.input-row label { display: block; font-size: 12px; color: #8E8E8E; font-weight: 600; margin-bottom: 4px; }
input[type="text"], input[type="url"], textarea {
  width: 100%; padding: 8px 12px; border: 1px solid #E8E5DF; border-radius: 10px;
  font-size: 13px; outline: none; background: #fff;
}
input:focus, textarea:focus { border-color: #F4A460; box-shadow: 0 0 0 3px rgba(244,164,96,.08); }
.flex-1 { flex: 1; min-width: 0; }

/* ── 上传行 ── */
.qr-upload-row { display: flex; gap: 8px; align-items: center; }
.file-input { font-size: 12px; max-width: 160px; }
.file-input::file-selector-button {
  padding: 4px 10px; border-radius: 8px; border: 1px solid #E8E5DF;
  background: #F9F8F6; cursor: pointer; font-size: 12px; font-family: inherit;
}
.btn-upload {
  padding: 6px 16px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  white-space: nowrap; transition: all .15s; font-family: inherit;
}
.btn-upload:hover:not(:disabled) { opacity: .9; }
.btn-upload:disabled { opacity: .45; cursor: not-allowed; }

.upload-ok { font-size: 12px; color: #5A8A6A; margin-top: 4px; }
.upload-fail { font-size: 12px; color: #C87878; margin-top: 4px; }

/* ── 预览 ── */
.qr-preview   { max-width: 120px; border-radius: 8px; margin-top: 6px; border: 1px solid rgba(125,158,138,0.12); }
.qr-preview-lg { max-width: 180px; border-radius: 8px; margin-top: 6px; border: 1px solid rgba(125,158,138,0.12); }
.btn-link { background: none; border: none; color: #C87878; font-size: 12px; cursor: pointer; padding: 0; }
.btn-link:hover { text-decoration: underline; }

.btn-primary {
  background: linear-gradient(135deg, #F4A460, #F7C57C);
  color: #fff; border: none; border-radius: 28px; padding: 12px 28px;
  font-size: 14px; font-weight: 700; cursor: pointer; transition: all .2s;
}
.btn-primary:disabled { opacity: .4; cursor: not-allowed; }

/* ── 弹窗声明 ── */
.toggle-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.toggle-label { font-size: 14px; font-weight: 600; color: #4A4A4A; }
.toggle-hint { font-size: 11px; color: #8E8E8E; margin: 0 0 12px; }

.toggle-switch { position: relative; display: inline-block; width: 48px; height: 26px; cursor: pointer; }
.toggle-switch input { display: none; }
.toggle-track {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: #D8D5CF; border-radius: 26px; transition: all .25s;
}
.toggle-track::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 20px; height: 20px; background: #fff;
  border-radius: 50%; transition: all .25s; box-shadow: 0 1px 3px rgba(0,0,0,.15);
}
.toggle-switch input:checked + .toggle-track { background: linear-gradient(135deg, #F4A460, #F7C57C); }
.toggle-switch input:checked + .toggle-track::after { transform: translateX(22px); }

/* ── 声明编辑器 ── */
.declaration-editor { margin-top: 14px; padding-top: 14px; border-top: 1px solid #F0EDE8; }
.editor-label { display: block; font-size: 12px; color: #8E8E8E; font-weight: 600; margin-bottom: 10px; }
.editor-row {
  background: #FAFAF8; border: 1px solid #F0EDE8; border-radius: 12px;
  padding: 12px 14px; margin-bottom: 10px;
}
.editor-row-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.editor-num { font-size: 13px; font-weight: 700; color: #B8933E; min-width: 22px; text-align: right; flex-shrink: 0; }
.editor-input {
  flex: 1; padding: 8px 12px; border: 1px solid #E8E5DF; border-radius: 10px;
  font-size: 13px; outline: none; background: #fff; font-family: inherit; min-width: 0;
}
.editor-input:focus { border-color: #F4A460; box-shadow: 0 0 0 3px rgba(244,164,96,.08); }
.btn-row-remove {
  background: none; border: none; color: #C0C0C0; font-size: 18px; cursor: pointer;
  padding: 0 4px; line-height: 1; flex-shrink: 0; transition: color .15s;
}
.btn-row-remove:hover { color: #C87878; }

/* 项目选择器行 */
.editor-row-bottom { display: flex; align-items: center; gap: 8px; }
.project-label { font-size: 12px; color: #8E8E8E; white-space: nowrap; flex-shrink: 0; }
.project-selector-area { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.project-select { flex: 1; min-width: 140px; }
.project-hint {
  font-size: 12px; color: #5A8A6A; background: #EDF6F0; padding: 2px 8px;
  border-radius: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;
}
.project-hint.dim { color: #8E8E8E; background: #F4F2EE; }

.editor-actions { display: flex; gap: 8px; margin-top: 6px; }
.btn-editor-add {
  padding: 6px 14px; border-radius: 10px; border: 1px solid #E8E5DF;
  background: #fff; font-size: 12px; cursor: pointer; color: #4A4A4A;
  transition: all .15s; font-family: inherit;
}
.btn-editor-add:hover:not(:disabled) { border-color: #F4A460; color: #F4A460; }
.btn-editor-add:disabled { opacity: .4; cursor: not-allowed; }

/* ── 移动端适配 ── */
@media (max-width: 767px) {
  .editor-row { padding: 10px; }
  .editor-row-top { flex-wrap: wrap; gap: 6px; }
  .editor-num { min-width: 18px; font-size: 12px; }
  .btn-row-remove { margin-left: auto; }
  .editor-row-bottom { flex-direction: column; align-items: stretch; gap: 6px; }
  .project-label { font-size: 11px; }
  .project-selector-area { flex-wrap: wrap; }
  .project-select { width: 100%; }
  .project-hint { max-width: 100%; }
}
</style>
