<template>
  <div class="not-found fade-in-up">
    <i class="fa-solid fa-circle-exclamation"></i>
    <h2>404</h2>
    <p>页面不存在</p>
    <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
  </div>
</template>

<style scoped>
.not-found {
  text-align: center; padding: 120px 20px; color: #8e8ea0;
}
.not-found i { font-size: 56px; margin-bottom: 16px; display: block; color: #a08080; }
.not-found h2 { font-size: 48px; font-weight: 800; margin: 0; color: #3a3a4a; }
.not-found p { margin: 8px 0 20px; font-size: 16px; }
</style>
