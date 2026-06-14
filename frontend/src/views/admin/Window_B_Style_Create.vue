<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { validateImageFile } from '@/utils/validateFile'
import { styleApi } from '@/api/styleApi'
import { storage } from '@/utils/storage'

const router = useRouter()

// ── 页面入场 stagger ──
const mounted = ref(false)
onMounted(() => {
  requestAnimationFrame(() => { mounted.value = true })
})

const form = ref({
  styleName: '',
  description: '',
  styleCoverUrl: '',
  preview_urls: [],
  singlePrice: 0,
  base_duration: 60,
  packages: [],
  additionalItems: [],
})

const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const previewInput = ref('')
const uploading = ref(false)
const styleImageFile = ref(null)
const uploadMsg = ref('')

function addPreviewUrl() {
  const url = previewInput.value.trim()
  if (url && !form.value.preview_urls.includes(url)) {
    form.value.preview_urls.push(url)
  }
  previewInput.value = ''
}

function removePreviewUrl(idx) {
  form.value.preview_urls.splice(idx, 1)
}

function onStyleFileChange(e) {
  const file = e.target.files[0] || null
  uploadMsg.value = ''
  if (file) {
    const v = validateImageFile(file)
    if (!v.valid) { uploadMsg.value = v.error; return }
  }
  styleImageFile.value = file
}

async function uploadStyleImage() {
  const file = styleImageFile.value
  if (!file) return
  uploading.value = true
  uploadMsg.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'styles')
    const token = storage.get('mzg_admin_token', '')
    const did = storage.get('mzg_device_id', '') || ('adm_' + Date.now())
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: {
        'x-device-id': did,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: fd
    }).then(r => r.json())
    if (res.code === 0 || res.success) {
      const url = (res.data && res.data.url) || res.url || ''
      if (!url) { uploadMsg.value = '上传成功但未获取到图片地址'; return }
      form.value.styleCoverUrl = url
      styleImageFile.value = null
      uploadMsg.value = 'success'
      const input = document.getElementById('style-file-input')
      if (input) input.value = ''
    } else {
      uploadMsg.value = res.message || '上传失败'
    }
  } catch (e) {
    uploadMsg.value = e?.message || '网络错误，上传失败'
  } finally {
    uploading.value = false
  }
}

function addPackage() {
  form.value.packages.push({
    name: '',
    photoCount: 10,
    totalPrice: 0,
    fixedDuration: 120,
    description: '',
  })
}

function removePackage(idx) {
  form.value.packages.splice(idx, 1)
}

function addAdditionalItem() {
  form.value.additionalItems.push({
    name: '',
    price: 0,
    unit: 'per_time',
  })
}

function removeAdditionalItem(idx) {
  form.value.additionalItems.splice(idx, 1)
}

async function submit() {
  errorMsg.value = ''
  successMsg.value = ''

  if (!form.value.styleName.trim()) {
    errorMsg.value = '请输入预设名称'
    return
  }
  if (!form.value.singlePrice || form.value.singlePrice <= 0) {
    errorMsg.value = '单张价格必填'
    return
  }
  loading.value = true

  const mId = storage.get('mzg_admin_mid', '')
  if (!mId) {
    errorMsg.value = '未登录，请先登录'
    loading.value = false
    return
  }

  const payload = {
    mId,
    styleName: form.value.styleName.trim(),
    styleCoverUrl: form.value.styleCoverUrl,
    singlePrice: Number(form.value.singlePrice),
    packages: form.value.packages
      .filter(p => p.name.trim() && p.totalPrice > 0)
      .map(p => ({
        name: p.name.trim(),
        photoCount: Number(p.photoCount),
        totalPrice: Number(p.totalPrice),
        fixedDuration: Number(p.fixedDuration),
        description: (p.description || '').trim(),
      })),
    additionalItems: form.value.additionalItems
      .filter(a => a.name.trim() && a.price > 0)
      .map(a => ({
        name: a.name.trim(),
        price: Number(a.price),
        unit: a.unit,
      })),
  }

  try {
    await styleApi.create(payload)
    successMsg.value = '样式创建成功，即将跳转...'
    setTimeout(() => router.push('/styles'), 800)
  } catch (e) {
    errorMsg.value = e.message || '创建失败'
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/styles')
}

// ── Stepper helpers ──
function stepDown(refKey, step = 0.01, min = 0) {
  const v = form.value[refKey]
  if (v <= min) return
  form.value[refKey] = +(v - step).toFixed(step < 1 ? 2 : 0)
}
function stepUp(refKey, step = 0.01) {
  form.value[refKey] = +(form.value[refKey] + step).toFixed(step < 1 ? 2 : 0)
}
</script>

<template>
  <div class="create-page fade-in-up" :class="{ ready: mounted }">

    <!-- ═══ 环境光斑 ═══ -->
    <div class="ambient-layer">
      <div class="ambient-orb orb--top"></div>
      <div class="ambient-orb orb--mid"></div>
      <div class="ambient-orb orb--bottom"></div>
    </div>

    <!-- ═══ 页面头部 ═══ -->
    <header class="page-hero">
      <button class="hero-back" @click="goBack" aria-label="返回列表">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span>样式列表</span>
      </button>

      <div class="hero-body">
        <div class="hero-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="4"/>
            <circle cx="8" cy="8" r="2"/>
            <path d="M22 14l-5 5-3-3"/>
            <path d="M14 2v4h4"/>
          </svg>
        </div>
        <h1 class="hero-title">创建样式资产</h1>
        <p class="hero-desc">定义一个新的拍摄风格模板，设置定价与套餐方案</p>
      </div>
    </header>

    <!-- ═══ 消息提示 ═══ -->
    <div class="msg-area">
      <Transition name="toast">
        <div v-if="errorMsg" class="toast toast--error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{{ errorMsg }}</span>
        </div>
      </Transition>
      <Transition name="toast">
        <div v-if="successMsg" class="toast toast--success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>{{ successMsg }}</span>
        </div>
      </Transition>
    </div>

    <!-- ═══ 表单主体：双栏 ═══ -->
    <div class="form-grid">

      <!-- ═══════════════ 左栏 · 基本信息 ═══════════════ -->
      <div class="form-col" style="--stagger: 1">
        <section class="panel panel--sage">
          <div class="panel-shine"></div>
          <div class="panel-topbar">
            <span class="panel-dot" style="--dot-color: #8aab96"></span>
            <h2 class="panel-heading">基本信息</h2>
          </div>

          <!-- 预设名称 -->
          <div class="field">
            <label class="field-label">预设名称 <span class="field-star">*</span></label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              <input
                v-model="form.styleName"
                placeholder="古风汉服、日系JK、法式复古..."
                maxlength="100"
                class="input-glass"
              />
            </div>
          </div>

          <!-- 描述 -->
          <div class="field">
            <label class="field-label">样式描述</label>
            <textarea
              v-model="form.description"
              placeholder="描述风格特点、适合场景与人群，让客户一眼了解..."
              rows="4"
              class="input-glass input-textarea"
            ></textarea>
            <span class="field-hint">{{ form.description.length }}/500</span>
          </div>

          <!-- 封面图 -->
          <div class="field">
            <label class="field-label">封面图片</label>
            <div class="upload-area" :class="{ 'has-file': styleImageFile }">
              <label for="style-file-input" class="upload-dropzone">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <div class="dropzone-text">
                  <span class="dropzone-title">{{ styleImageFile ? styleImageFile.name : '点击选择图片' }}</span>
                  <span class="dropzone-hint" v-if="!styleImageFile">PNG / JPG / WebP，建议 4:3 比例</span>
                  <span class="dropzone-hint" v-else>{{ (styleImageFile.size / 1024).toFixed(0) }} KB</span>
                </div>
              </label>
              <input id="style-file-input" type="file" accept="image/*" @change="onStyleFileChange" hidden />
              <button
                type="button"
                class="upload-action"
                :class="{ spinning: uploading }"
                :disabled="!styleImageFile || uploading"
                @click="uploadStyleImage"
              >
                <svg v-if="!uploading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span v-if="uploading" class="spinner-ring"></span>
                {{ uploading ? '上传中' : '上传' }}
              </button>
            </div>
            <Transition name="toast">
              <p v-if="uploadMsg === 'success'" class="upload-ok">封面图上传成功</p>
              <p v-else-if="uploadMsg" class="upload-fail">{{ uploadMsg }}</p>
            </Transition>
            <Transition name="reveal-img">
              <div v-if="form.styleCoverUrl" class="cover-frame">
                <img :src="form.styleCoverUrl" alt="封面预览" />
                <div class="cover-frame-shine"></div>
              </div>
            </Transition>
          </div>

          <!-- 附加项目 -->
          <div class="field">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
              <label class="field-label">附加项目</label>
              <span style="font-size:11px;color:#8e8e93;">{{ form.additionalItems.length }} 个项目</span>
            </div>

            <div v-for="(item, idx) in form.additionalItems" :key="idx" class="addon-box" style="margin-bottom:10px;">
              <div class="addon-stripe"></div>
              <div class="addon-inner">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                  <span style="font-size:12px;font-weight:700;color:#c9a0a0;">项目 {{ idx + 1 }}</span>
                  <button type="button" class="pkg-remove-btn" @click="removeAdditionalItem(idx)">删除</button>
                </div>
                <div class="field">
                  <label class="field-label">项目名称</label>
                  <input v-model="item.name" placeholder="如: 精致化妆" maxlength="64" class="input-glass" />
                </div>
                <div class="field" style="display:flex;gap:12px;">
                  <div style="flex:1">
                    <label class="field-label">金额</label>
                    <div class="stepper-group">
                      <button type="button" class="stepper-btn" @click="item.price = Math.max(0, (item.price || 0) - 0.01)">−</button>
                      <div class="stepper-value-wrap"><input type="number" v-model.number="item.price" min="0" step="0.01" class="stepper-input" /><span class="stepper-unit">元</span></div>
                      <button type="button" class="stepper-btn" @click="item.price = (item.price || 0) + 0.01">+</button>
                    </div>
                  </div>
                  <div style="flex:1">
                    <label class="field-label">计费单位</label>
                    <select v-model="item.unit" class="input-glass" style="padding:12px 14px;">
                      <option value="per_time">元 / 次</option>
                      <option value="per_photo">元 / 张</option>
                      <option value="per_item">元 / 个</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <button type="button" class="pkg-add-glass" @click="addAdditionalItem">
              + 添加附加项目
            </button>
          </div>

          <!-- 预览图列表 -->
          <div class="field" style="margin-bottom:0">
            <label class="field-label">预览图</label>
            <TransitionGroup name="chip-list" tag="div" class="chip-stack">
              <div v-for="(url, idx) in form.preview_urls" :key="url" class="chip">
                <span class="chip-url">{{ url }}</span>
                <button class="chip-del" @click="removePreviewUrl(idx)" aria-label="移除">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </TransitionGroup>
            <div class="url-add-row">
              <input
                v-model="previewInput"
                placeholder="粘贴图片 URL，按回车添加"
                class="input-glass input-sm"
                @keyup.enter="addPreviewUrl"
              />
              <button type="button" class="chip-add-btn" @click="addPreviewUrl">添加</button>
            </div>
          </div>
        </section>
      </div>

      <!-- ═══════════════ 右栏 · 定价与操作 ═══════════════ -->
      <div class="form-col" style="--stagger: 2">
        <section class="panel panel--rose">
          <div class="panel-shine"></div>
          <div class="panel-topbar">
            <span class="panel-dot" style="--dot-color: #c9a0a0"></span>
            <h2 class="panel-heading">定价与时长</h2>
          </div>

          <!-- 单张价格 -->
          <div class="field">
            <label class="field-label">单张收费 <span class="field-star">*</span></label>
            <div class="stepper-group">
              <button type="button" class="stepper-btn" @click="stepDown('singlePrice', 0.01, 0)" aria-label="减少">−</button>
              <div class="stepper-value-wrap">
                <input
                  type="number"
                  v-model.number="form.singlePrice"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="stepper-input"
                />
                <span class="stepper-unit">元 / 张</span>
              </div>
              <button type="button" class="stepper-btn" @click="stepUp('singlePrice', 0.01)" aria-label="增加">+</button>
            </div>
          </div>

          <!-- 基础时长 -->
          <div class="field">
            <label class="field-label">基础拍摄时长</label>
            <div class="stepper-group">
              <button type="button" class="stepper-btn" @click="stepDown('base_duration', 5, 5)" aria-label="减少">−</button>
              <div class="stepper-value-wrap">
                <input
                  type="number"
                  v-model.number="form.base_duration"
                  min="5"
                  step="5"
                  class="stepper-input"
                />
                <span class="stepper-unit">分钟</span>
              </div>
              <button type="button" class="stepper-btn" @click="stepUp('base_duration', 5)" aria-label="增加">+</button>
            </div>
          </div>

          <!-- 分隔 -->
          <div class="hairline"></div>

          <!-- ★ 多套餐动态配置 -->
          <div class="field">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
              <label class="field-label">套餐配置</label>
              <span style="font-size:11px;color:#8e8e93;">{{ form.packages.length }} 个套餐</span>
            </div>

            <div v-for="(pkg, idx) in form.packages" :key="idx" class="package-box" style="margin-bottom:12px;">
              <div class="package-stripe"></div>
              <div class="package-inner">
                <div class="pkg-header-row">
                  <span class="pkg-idx">套餐 {{ idx + 1 }}</span>
                  <button type="button" class="pkg-remove-btn" @click="removePackage(idx)">🗑️ 删除此套餐</button>
                </div>
                <div class="field">
                  <label class="field-label">套餐名称</label>
                  <input v-model="pkg.name" placeholder="如: 10张精修套餐" maxlength="64" class="input-glass" />
                </div>
                <div class="field" style="display:flex;gap:12px;">
                  <div style="flex:1">
                    <label class="field-label">包含张数</label>
                    <div class="stepper-group">
                      <button type="button" class="stepper-btn" @click="pkg.photoCount = Math.max(1, pkg.photoCount - 1)">−</button>
                      <div class="stepper-value-wrap"><input type="number" v-model.number="pkg.photoCount" min="1" class="stepper-input" /><span class="stepper-unit">张</span></div>
                      <button type="button" class="stepper-btn" @click="pkg.photoCount = (pkg.photoCount || 1) + 1">+</button>
                    </div>
                  </div>
                  <div style="flex:1">
                    <label class="field-label">固定总价</label>
                    <div class="stepper-group">
                      <button type="button" class="stepper-btn" @click="pkg.totalPrice = Math.max(0, (pkg.totalPrice || 0) - 0.01)">−</button>
                      <div class="stepper-value-wrap"><input type="number" v-model.number="pkg.totalPrice" min="0" step="0.01" class="stepper-input" /><span class="stepper-unit">元</span></div>
                      <button type="button" class="stepper-btn" @click="pkg.totalPrice = (pkg.totalPrice || 0) + 0.01">+</button>
                    </div>
                  </div>
                </div>
                <div class="field" style="margin-bottom:0">
                  <label class="field-label">固定耗时</label>
                  <div class="stepper-group">
                    <button type="button" class="stepper-btn" @click="pkg.fixedDuration = Math.max(5, pkg.fixedDuration - 5)">−</button>
                    <div class="stepper-value-wrap"><input type="number" v-model.number="pkg.fixedDuration" min="5" step="5" class="stepper-input" /><span class="stepper-unit">分钟</span></div>
                    <button type="button" class="stepper-btn" @click="pkg.fixedDuration = (pkg.fixedDuration || 5) + 5">+</button>
                  </div>
                </div>
                <div class="field" style="margin-bottom:0;margin-top:12px;">
                  <label class="field-label">套餐描述</label>
                  <input v-model="pkg.description" placeholder="如: 含精修+底片全送" maxlength="256" class="input-glass" />
                </div>
              </div>
            </div>

            <button type="button" class="pkg-add-glass" @click="addPackage">
              ➕ 添加新套餐
            </button>
          </div>
        </section>

        <!-- 操作按钮 -->
        <div class="action-bar">
          <button type="button" class="btn-back" @click="goBack">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            返回
          </button>
          <button
            type="button"
            class="btn-submit"
            :class="{ loading }"
            :disabled="loading || uploading"
            @click="submit"
          >
            <span v-if="loading" class="spinner-ring spinner-ring--light"></span>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            {{ loading ? '创建中...' : '创建样式' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════
   CSS 变量 · 莫兰迪色板 · 来自全局 theme.css
   ═══════════════════════════════════════════════════════════════════ */
.create-page {
  --sage:        #8aab96;
  --sage-soft:   rgba(138,171,150,.08);
  --sage-glow:   rgba(138,171,150,.14);
  --rose:        #c9a0a0;
  --rose-soft:   rgba(201,160,160,.08);
  --rose-glow:   rgba(201,160,160,.14);
  --sky:         #9aafc4;
  --sky-soft:    rgba(154,175,196,.07);
  --wheat:       #c9b896;
  --ink:         #1d1d1f;
  --ink-soft:    #3a3a3f;
  --ash:         #6e6e73;
  --ash-light:   #8e8e93;
  --line:        rgba(180,185,182,.16);
  --line-solid:  #e5e5ea;
  --white-60:    rgba(255,255,255,.60);
  --white-48:    rgba(255,255,255,.48);
  --white-32:    rgba(255,255,255,.32);
  --white-18:    rgba(255,255,255,.18);
  --glass-blur:  blur(28px);
  --glass-blur-sm: blur(12px);
  --radius-sm:   10px;
  --radius-md:   14px;
  --radius-lg:   20px;
  --radius-xl:   24px;
  --radius-2xl:  28px;
  --ease-apple:  cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-spring: cubic-bezier(0.34, 1.3, 0.64, 1);
  --ease-out:    cubic-bezier(0, 0, 0.2, 1);
}

/* ═══════════════════════════════════════════════════════════════════
   页面基础
   ═══════════════════════════════════════════════════════════════════ */
.create-page {
  min-height: 100vh;
  padding: 48px 24px 80px;
  position: relative;
  z-index: 1;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.6s var(--ease-apple), transform 0.6s var(--ease-apple);
}
.create-page.ready {
  opacity: 1;
  transform: translateY(0);
}

/* ═══════════════════════════════════════════════════════════════════
   环境光斑 · 三层弥散光
   ═══════════════════════════════════════════════════════════════════ */
.ambient-layer { pointer-events: none; position: fixed; inset: 0; z-index: 0; }
.ambient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
}
.orb--top {
  top: -15%; right: -5%;
  width: 44vmax; height: 44vmax;
  background: radial-gradient(circle, rgba(160,190,175,.09) 0%, transparent 70%);
  animation: drift-a 20s ease-in-out infinite;
}
.orb--mid {
  top: 50%; left: -8%;
  width: 32vmax; height: 32vmax;
  background: radial-gradient(circle, rgba(200,180,190,.05) 0%, transparent 70%);
  animation: drift-b 24s ease-in-out infinite;
}
.orb--bottom {
  bottom: -10%; right: 10%;
  width: 36vmax; height: 36vmax;
  background: radial-gradient(circle, rgba(170,185,200,.06) 0%, transparent 70%);
  animation: drift-c 22s ease-in-out infinite;
}
@keyframes drift-a {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%  { transform: translate(40px, -30px) scale(1.06); }
  66%  { transform: translate(-20px, 20px) scale(0.95); }
}
@keyframes drift-b {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%  { transform: translate(-35px, 25px) scale(1.05); }
  66%  { transform: translate(25px, -15px) scale(0.96); }
}
@keyframes drift-c {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%  { transform: translate(-30px, -25px) scale(1.07); }
}

/* ═══════════════════════════════════════════════════════════════════
   页面头部
   ═══════════════════════════════════════════════════════════════════ */
.page-hero {
  position: relative;
  max-width: 900px;
  margin: 0 auto 40px;
  z-index: 1;
}
.hero-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  margin-bottom: 24px;
  border: 1px solid var(--line);
  border-radius: 9999px;
  background: var(--white-48);
  backdrop-filter: var(--glass-blur-sm);
  -webkit-backdrop-filter: var(--glass-blur-sm);
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s var(--ease-apple);
}
.hero-back:hover {
  background: var(--white-60);
  border-color: rgba(180,185,182,.30);
  transform: translateX(-2px);
}
.hero-back:active { transform: scale(0.95); }

.hero-body {
  text-align: center;
}
.hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px; height: 60px;
  border-radius: 20px;
  margin-bottom: 18px;
  background: linear-gradient(135deg, var(--sage-soft), rgba(155,184,166,.05));
  border: 1px solid rgba(138,171,150,.10);
  color: var(--sage);
  animation: float-icon 4s ease-in-out infinite;
}
@keyframes float-icon {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-5px); }
}

.hero-title {
  font-size: 30px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.4px;
  margin-bottom: 6px;
}
.hero-desc {
  font-size: 15px;
  color: var(--ash);
  font-weight: 400;
  max-width: 380px;
  margin: 0 auto;
  line-height: 1.5;
}

/* ═══════════════════════════════════════════════════════════════════
   消息 Toast
   ═══════════════════════════════════════════════════════════════════ */
.msg-area {
  max-width: 900px;
  margin: 0 auto 24px;
  position: relative;
  z-index: 1;
}
.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-radius: var(--radius-lg);
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.4;
  backdrop-filter: var(--glass-blur-sm);
  -webkit-backdrop-filter: var(--glass-blur-sm);
}
.toast--error {
  background: rgba(201,138,138,.08);
  border: 1px solid rgba(201,138,138,.14);
  color: #a05050;
}
.toast--success {
  background: rgba(140,170,148,.08);
  border: 1px solid rgba(140,170,148,.14);
  color: #4a6e52;
}

/* Toast 动画 */
.toast-enter-active { transition: all 0.35s var(--ease-apple); }
.toast-leave-active { transition: all 0.2s var(--ease-out); }
.toast-enter-from { opacity: 0; transform: translateY(-10px); }
.toast-leave-to   { opacity: 0; transform: translateY(-6px); }

/* ═══════════════════════════════════════════════════════════════════
   双栏表单布局
   ═══════════════════════════════════════════════════════════════════ */
.form-grid {
  max-width: 900px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
  position: relative;
  z-index: 1;
}
/* 入场 stagger */
.form-col {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.55s var(--ease-apple), transform 0.55s var(--ease-apple);
  transition-delay: calc(var(--stagger, 1) * 0.12s);
}
.create-page.ready .form-col {
  opacity: 1;
  transform: translateY(0);
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .create-page { padding: 28px 14px 50px; }
  .page-hero { margin-bottom: 28px; }
  .hero-title { font-size: 25px; }
  .hero-back { margin-bottom: 16px; }
}

/* ═══════════════════════════════════════════════════════════════════
   Liquid Glass 面板
   ═══════════════════════════════════════════════════════════════════ */
.panel {
  background: rgba(255,255,255,.50);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid rgba(255,255,255,.32);
  border-radius: var(--radius-2xl);
  padding: 26px 28px 28px;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 4px 28px rgba(120,130,125,.04),
    0 1px 3px rgba(0,0,0,.015);
  transition: box-shadow 0.45s var(--ease-apple), border-color 0.45s var(--ease-apple);
}
.panel:hover {
  box-shadow:
    0 8px 40px rgba(120,130,125,.08),
    0 1px 3px rgba(0,0,0,.015);
  border-color: rgba(255,255,255,.50);
}
/* 顶部高光线 */
.panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
  pointer-events: none;
  z-index: 2;
}
/* 面板柔光层 · 模拟玻璃内折射 */
.panel-shine {
  position: absolute;
  top: -50%; left: 10%; right: 10%;
  height: 100%;
  background: radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.18) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

/* 面板顶栏 */
.panel-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  position: relative;
  z-index: 1;
}
.panel-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--dot-color, #8aab96);
  box-shadow: 0 0 14px color-mix(in srgb, var(--dot-color, #8aab96) 40%, transparent);
}
.panel-heading {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.2px;
}

/* ═══════════════════════════════════════════════════════════════════
   表单字段
   ═══════════════════════════════════════════════════════════════════ */
.field {
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}
.field:last-child { margin-bottom: 0; }

.field-label {
  display: block;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ink-soft);
  margin-bottom: 8px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
.field-star { color: #c98a8a; }
.field-hint {
  display: block;
  text-align: right;
  font-size: 11px;
  color: var(--ash-light);
  margin-top: 4px;
}

/* ═══════════════════════════════════════════════════════════════════
   Glass Input
   ═══════════════════════════════════════════════════════════════════ */
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 14px;
  color: var(--ash-light);
  pointer-events: none;
  z-index: 1;
}
.input-icon + .input-glass { padding-left: 40px; }

.input-glass {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  color: var(--ink-soft);
  background: rgba(255,255,255,.48);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  outline: none;
  transition: all 0.25s var(--ease-apple);
}
.input-glass:focus {
  border-color: rgba(138,171,150,.40);
  box-shadow: 0 0 0 4px rgba(138,171,150,.06);
  background: rgba(255,255,255,.68);
}
.input-glass::placeholder { color: var(--ash-light); }

.input-textarea {
  resize: vertical;
  min-height: 100px;
  line-height: 1.65;
}
.input-sm { padding: 9px 14px; font-size: 13px; }

/* ═══════════════════════════════════════════════════════════════════
   图片上传区
   ═══════════════════════════════════════════════════════════════════ */
.upload-area {
  display: flex;
  align-items: stretch;
  gap: 10px;
}
.upload-dropzone {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border: 1.5px dashed var(--line);
  border-radius: var(--radius-lg);
  cursor: pointer;
  background: rgba(255,255,255,.28);
  transition: all 0.25s var(--ease-apple);
  overflow: hidden;
  color: var(--ash);
}
.upload-dropzone:hover {
  border-color: rgba(138,171,150,.30);
  background: rgba(255,255,255,.50);
}
.upload-area.has-file .upload-dropzone {
  border-style: solid;
  border-color: rgba(138,171,150,.18);
  background: rgba(138,171,150,.04);
}
.dropzone-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dropzone-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dropzone-hint { font-size: 11px; color: var(--ash-light); }

.upload-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 22px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, #8aab96, #9bb8a6);
  box-shadow: 0 3px 14px rgba(138,171,150,.22);
  transition: all 0.25s var(--ease-apple);
  white-space: nowrap;
  flex-shrink: 0;
}
.upload-action:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(138,171,150,.32);
  transform: translateY(-1px);
}
.upload-action:active:not(:disabled) { transform: scale(0.95); }
.upload-action:disabled {
  background: #c0c5c2;
  box-shadow: none;
  cursor: not-allowed;
}
.upload-action.spinning { opacity: .85; }

.upload-ok {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #5a7a60;
}
.upload-fail {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #c98a8a;
}

/* 封面预览 */
.cover-frame {
  position: relative;
  margin-top: 14px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid rgba(180,185,182,.12);
}
.cover-frame img {
  display: block;
  width: 100%;
  max-height: 200px;
  object-fit: cover;
}
.cover-frame-shine {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 40%;
  background: linear-gradient(180deg, rgba(255,255,255,.12) 0%, transparent 100%);
  pointer-events: none;
}

/* 封面图揭示动画 */
.reveal-img-enter-active { transition: all 0.45s var(--ease-apple); }
.reveal-img-leave-active { transition: all 0.2s var(--ease-out); }
.reveal-img-enter-from { opacity: 0; transform: translateY(8px) scale(.96); }
.reveal-img-leave-to   { opacity: 0; }

/* ═══════════════════════════════════════════════════════════════════
   预览图 URL Chips
   ═══════════════════════════════════════════════════════════════════ */
.chip-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  min-height: 0;
}
.chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  background: rgba(255,255,255,.48);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(180,185,182,.08);
  border-radius: var(--radius-sm);
  font-size: 12px;
}
.chip-url {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ash);
}
.chip-del {
  flex-shrink: 0;
  width: 22px; height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  color: #c98a8a;
  border-radius: 50%;
  transition: all 0.15s ease;
}
.chip-del:hover { background: rgba(201,138,138,.10); }

.url-add-row {
  display: flex;
  gap: 8px;
}
.chip-add-btn {
  padding: 9px 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--white-48);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #5a7a65;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s var(--ease-apple);
}
.chip-add-btn:hover {
  border-color: rgba(138,171,150,.30);
  background: rgba(138,171,150,.06);
}
.chip-add-btn:active { transform: scale(.95); }

/* Chip 列表动画 */
.chip-list-enter-active { transition: all 0.3s var(--ease-apple); }
.chip-list-leave-active { transition: all 0.2s var(--ease-out); }
.chip-list-enter-from { opacity: 0; transform: translateX(-14px); }
.chip-list-leave-to   { opacity: 0; transform: translateX(14px); }
.chip-list-move       { transition: transform 0.3s var(--ease-apple); }

/* ═══════════════════════════════════════════════════════════════════
   Stepper 数字输入组
   ═══════════════════════════════════════════════════════════════════ */
.stepper-group {
  display: flex;
  align-items: stretch;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--line);
  background: rgba(255,255,255,.48);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: border-color 0.25s var(--ease-apple), box-shadow 0.25s var(--ease-apple);
}
.stepper-group:focus-within {
  border-color: rgba(138,171,150,.40);
  box-shadow: 0 0 0 4px rgba(138,171,150,.06);
}

.stepper-btn {
  width: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 500;
  color: var(--ash);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s var(--ease-apple);
  user-select: none;
}
.stepper-btn:hover {
  background: rgba(138,171,150,.06);
  color: var(--sage);
}
.stepper-btn:active { background: rgba(138,171,150,.10); }

.stepper-value-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0;
  border-left: 1px solid var(--line);
  border-right: 1px solid var(--line);
}
.stepper-input {
  width: 90px;
  padding: 12px 10px;
  border: none;
  font-size: 14px;
  font-family: inherit;
  color: var(--ink-soft);
  background: transparent;
  outline: none;
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
}
.stepper-input::-webkit-outer-spin-button,
.stepper-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.stepper-unit {
  padding-right: 12px;
  font-size: 12px;
  color: var(--ash-light);
  font-weight: 500;
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════════════════════
   分隔线
   ═══════════════════════════════════════════════════════════════════ */
.hairline {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--line), transparent);
  margin: 22px 0;
}

/* ═══════════════════════════════════════════════════════════════════
   Toggle 开关 · 莫兰迪灰玫瑰
   ═══════════════════════════════════════════════════════════════════ */
.toggle-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border-radius: var(--radius-lg);
  background: rgba(255,255,255,.32);
  border: 1px solid rgba(180,185,182,.10);
  cursor: pointer;
  transition: all 0.4s var(--ease-apple);
  user-select: none;
}
.toggle-row:hover { background: rgba(255,255,255,.50); }
.toggle-row.on {
  background: rgba(201,160,160,.05);
  border-color: rgba(201,160,160,.15);
  box-shadow: 0 0 0 4px rgba(201,160,160,.03);
}

/* 轨道 */
.toggle-rail {
  width: 50px; height: 30px;
  border-radius: 15px;
  background: rgba(180,185,182,.22);
  flex-shrink: 0;
  position: relative;
  transition: background 0.4s var(--ease-apple);
}
.toggle-row.on .toggle-rail {
  background: linear-gradient(135deg, #c9a0a0, #d4b4a8);
}

/* 滑块 */
.toggle-knob {
  position: absolute;
  top: 3px; left: 3px;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02);
  transition: transform 0.4s var(--ease-spring);
  display: flex;
  align-items: center;
  justify-content: center;
}
.toggle-row.on .toggle-knob { transform: translateX(20px); }
.toggle-knob-icon {
  width: 12px; height: 12px;
  color: #c9a0a0;
  opacity: 0;
  transform: scale(.4);
  transition: all 0.3s var(--ease-spring) 0.08s;
}
.toggle-row.on .toggle-knob-icon { opacity: 1; transform: scale(1); }

.toggle-info { display: flex; flex-direction: column; gap: 2px; }
.toggle-info-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-soft);
  transition: color 0.35s var(--ease-apple);
}
.toggle-row.on .toggle-info-title { color: #8a5a5a; }
.toggle-info-sub { font-size: 11px; color: var(--ash-light); }

/* ═══════════════════════════════════════════════════════════════════
   套餐配置面板
   ═══════════════════════════════════════════════════════════════════ */
.package-box, .addon-box {
  margin-top: 16px;
  border-radius: var(--radius-lg);
  background: rgba(255,255,255,.38);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(201,160,160,.08);
  overflow: hidden;
}
.package-stripe, .addon-stripe {
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(201,160,160,.30), transparent);
}
.package-inner, .addon-inner { padding: 18px 20px 20px; }

.pkg-header-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px;
}
.pkg-idx {
  font-size: 12px; font-weight: 700; color: #c9a0a0;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.pkg-remove-btn {
  height: 28px; border-radius: 14px; padding: 0 14px;
  border: 1px solid rgba(201,160,160,.25);
  background: none; cursor: pointer;
  font-size: 12px; color: #c9a0a0;
  display: flex; align-items: center; gap: 4px;
  transition: all 0.15s; font-family: inherit;
}
.pkg-remove-btn:hover { background: rgba(201,160,160,.08); border-color: rgba(201,160,160,.40); }

/* 添加套餐按钮（玻璃风格） */
.pkg-add-glass {
  width: 100%; padding: 12px;
  border: 2px dashed rgba(201,160,160,.30);
  border-radius: var(--radius-lg);
  background: rgba(255,255,255,.32);
  backdrop-filter: blur(6px);
  font-size: 14px; font-weight: 600; color: #8a5a5a;
  font-family: inherit; cursor: pointer;
  transition: all 0.2s var(--ease-apple);
}
.pkg-add-glass:hover {
  border-color: rgba(201,160,160,.50);
  background: rgba(201,160,160,.05);
  color: #6a4040;
}

/* 展开/收起 */
.expand-package-enter-active { transition: all 0.4s var(--ease-apple); }
.expand-package-leave-active { transition: all 0.25s var(--ease-out); }
.expand-package-enter-from,
.expand-package-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
  transform: translateY(-8px);
}
.expand-package-enter-to,
.expand-package-leave-from {
  opacity: 1;
  max-height: 500px;
  margin-top: 16px;
  transform: translateY(0);
}

/* ═══════════════════════════════════════════════════════════════════
   操作按钮栏
   ═══════════════════════════════════════════════════════════════════ */
.action-bar {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-back,
.btn-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 15px 24px;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: all 0.25s var(--ease-apple);
}
.btn-back:active,
.btn-submit:active { transform: scale(.95); }

.btn-back {
  flex: 1;
  color: var(--ink-soft);
  background: rgba(255,255,255,.50);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--line);
}
.btn-back:hover {
  background: rgba(255,255,255,.72);
  border-color: rgba(180,185,182,.30);
}

.btn-submit {
  flex: 2.2;
  color: #fff;
  background: linear-gradient(135deg, #8aab96 0%, #9bb8a6 100%);
  box-shadow: 0 4px 20px rgba(138,171,150,.24), 0 1px 3px rgba(0,0,0,.03);
}
.btn-submit:hover:not(:disabled) {
  box-shadow: 0 8px 28px rgba(138,171,150,.36), 0 2px 6px rgba(0,0,0,.04);
  transform: translateY(-1px);
}
.btn-submit:active:not(:disabled) { transform: scale(.95); }
.btn-submit:disabled {
  background: #c0c5c2;
  box-shadow: none;
  cursor: not-allowed;
}
.btn-submit.loading { opacity: .85; cursor: wait; }

/* ═══════════════════════════════════════════════════════════════════
   Spinner
   ═══════════════════════════════════════════════════════════════════ */
.spinner-ring {
  display: inline-block;
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,.30);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
