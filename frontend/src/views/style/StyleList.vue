<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStyleStore } from '@/stores/style'
import { storage, getQueryParam } from '@/utils/storage'

const router = useRouter()
const styleStore = useStyleStore()
const styles = ref([])
const loading = ref(true)

onMounted(async () => {
  // C端: 全量URL扫描 → route.query → client localStorage
  // B端: admin localStorage 作为后台兜底
  const isAdmin = router.currentRoute?.value?.path?.startsWith('/admin')
  const mId = getQueryParam('mId')
    || storage.get('mzg_client_mid', '')
    || (isAdmin ? storage.get('mzg_admin_mid', '') : '')
  if (mId) {
    await styleStore.fetchStyles(mId)
  }
  styles.value = styleStore.styles
  loading.value = false
})

function goCreate() {
  router.push('/admin/styles/create')
}
</script>

<template>
  <div class="style-list fade-in-up" style="padding:16px;max-width:800px;margin:0 auto;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <button class="btn-secondary btn-sm" @click="router.push('/admin/orders')" style="flex-shrink:0;">← 返回后台</button>
      <h1 style="font-size:20px;flex:1;">&#x1F3A8; 预设库</h1>
      <button class="btn-primary" @click="goCreate" style="width:auto;padding:8px 18px;font-size:13px;">+ 添加预设</button>
    </div>

    <div v-if="loading" style="text-align:center;padding:40px;color:var(--sub);">加载中...</div>

    <div v-else-if="styles.length===0" style="text-align:center;padding:60px;color:var(--sub);">
      <div style="font-size:40px;opacity:.2;margin-bottom:10px;">&#x1F3A8;</div>
      暂无样式，请点击上方按钮添加
    </div>

    <div v-else class="section" v-for="s in styles" :key="s.id" style="padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;">
      <img v-if="s.styleCoverUrl" :src="s.styleCoverUrl" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px;" />
      <div v-else style="width:56px;height:56px;border-radius:10px;background:var(--purple-light);display:flex;align-items:center;justify-content:center;font-size:20px;">&#x1F3A8;</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;">{{ s.styleName }}</div>
        <div style="font-size:12px;color:var(--sub);margin-top:2px;">
          <span style="color:var(--purple);font-weight:600;">&yen;{{ s.singlePrice || 0 }}/张</span>
          <span v-if="s.hasPackage" style="color:var(--mint);margin-left:4px;">
            &middot; 套餐&yen;{{ s.packagePrice }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
