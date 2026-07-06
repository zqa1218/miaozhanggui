<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goUser() {
  router.push('/studio-filter')
}

function goAdmin() {
  router.push('/admin/login')
}
</script>

<template>
  <div class="welcome">
    <!-- 背景装饰 -->
    <div class="decorations">
      <span class="cloud cloud-1">☁️</span>
      <span class="cloud cloud-2">☁️</span>
      <span class="cloud cloud-3">☁️</span>
      <span class="star star-1">⭐</span>
      <span class="star star-2">✨</span>
      <span class="star star-3">🌟</span>
      <span class="star star-4">⭐</span>
      <span class="star star-5">✨</span>
    </div>

    <!-- 主标题 -->
    <div class="hero">
      <span class="hero-icon">📸</span>
      <h1 class="hero-title">喵掌柜</h1>
      <p class="hero-subtitle">发现你的专属摄影师</p>
      <p class="hero-desc">一站式摄影写真预约平台，轻松预约，定格美好瞬间</p>
    </div>

    <!-- 特色卡片 -->
    <div class="features">
      <div class="feature-card">
        <span class="feature-icon">🏠</span>
        <h3>海量工作室</h3>
        <p>浏览各类风格的摄影工作室，找到最适合你的摄影师</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">📅</span>
        <h3>自由选择时段</h3>
        <p>灵活挑选日期和时间，按你的节奏安排拍摄计划</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">🔒</span>
        <h3>安全支付</h3>
        <p>定金锁定预约，拍摄完成再付尾款，资金安全有保障</p>
      </div>
    </div>

    <!-- 按钮组 -->
    <div class="actions">
      <button class="btn-user" @click="goUser">
        <span class="btn-icon">🎀</span>
        我是用户
        <span class="btn-hint">浏览工作室，预约拍摄</span>
      </button>
      <button class="btn-admin" @click="goAdmin">
        <span class="btn-icon">🏪</span>
        我是商家
        <span class="btn-hint">管理后台，处理订单</span>
      </button>
    </div>

    <!-- 底部说明 -->
    <p class="footer-note">已注册商家？<a href="/admin/login">点击登录管理后台</a></p>
  </div>
</template>

<style scoped>
.welcome {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: linear-gradient(160deg, #fce4ec 0%, #f3e5f5 40%, #e8eaf6 100%);
  position: relative;
  overflow: hidden;
  text-align: center;
}

/* ── 背景装饰 ── */
.decorations {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cloud {
  position: absolute;
  font-size: 60px;
  opacity: 0.45;
  animation: floatCloud linear infinite;
}
.cloud-1 { top: 8%;  left: 5%;  animation-duration: 18s; font-size: 70px; }
.cloud-2 { top: 15%; right: 8%; animation-duration: 22s; font-size: 55px; animation-delay: -5s; }
.cloud-3 { top: 5%;  left: 55%; animation-duration: 25s; font-size: 50px; animation-delay: -10s; }

@keyframes floatCloud {
  0%   { transform: translateX(0); }
  25%  { transform: translateX(30px); }
  50%  { transform: translateX(-15px); }
  75%  { transform: translateX(20px); }
  100% { transform: translateX(0); }
}

.star {
  position: absolute;
  font-size: 24px;
  opacity: 0.6;
  animation: twinkle ease-in-out infinite;
}
.star-1 { bottom: 12%; left: 10%;  animation-duration: 2.5s; font-size: 20px; }
.star-2 { bottom: 18%; right: 12%; animation-duration: 3s;   font-size: 26px; animation-delay: -0.8s; }
.star-3 { top:    25%; left: 15%;  animation-duration: 2s;   font-size: 22px; animation-delay: -1.5s; }
.star-4 { bottom: 25%; left: 70%;  animation-duration: 2.8s; font-size: 18px; }
.star-5 { top:    35%; right: 20%; animation-duration: 3.2s; font-size: 20px; animation-delay: -2s; }

@keyframes twinkle {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50%      { opacity: 0.85; transform: scale(1.25); }
}

/* ── 主标题 ── */
.hero {
  position: relative;
  z-index: 1;
  margin-bottom: 40px;
}

.hero-icon {
  display: block;
  font-size: 72px;
  margin-bottom: 12px;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-12px); }
}

.hero-title {
  font-size: 48px;
  font-weight: 800;
  color: #ad1457;
  margin: 0 0 8px;
  letter-spacing: 4px;
  text-shadow: 0 2px 8px rgba(173, 20, 87, 0.15);
}

.hero-subtitle {
  font-size: 20px;
  color: #7b1fa2;
  margin: 0 0 12px;
  font-weight: 500;
}

.hero-desc {
  font-size: 14px;
  color: #757575;
  margin: 0;
}

/* ── 特色卡片 ── */
.features {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 16px;
  margin-bottom: 40px;
  max-width: 720px;
  width: 100%;
}

.feature-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.75);
  border-radius: 16px;
  padding: 24px 16px;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1);
}

.feature-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 8px;
}

.feature-card h3 {
  font-size: 16px;
  color: #424242;
  margin: 0 0 6px;
  font-weight: 600;
}

.feature-card p {
  font-size: 13px;
  color: #9e9e9e;
  margin: 0;
  line-height: 1.5;
}

/* ── 按钮 ── */
.actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 16px;
  max-width: 460px;
  width: 100%;
}

.btn-user, .btn-admin {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 24px;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
}

.btn-user {
  background: linear-gradient(135deg, #f48fb1, #ce93d8);
  color: #fff;
  box-shadow: 0 4px 16px rgba(244, 143, 177, 0.4);
}

.btn-admin {
  background: linear-gradient(135deg, #9575cd, #7986cb);
  color: #fff;
  box-shadow: 0 4px 16px rgba(149, 117, 205, 0.4);
}

.btn-user:hover, .btn-admin:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.btn-user:active, .btn-admin:active {
  transform: translateY(0);
}

.btn-icon {
  font-size: 28px;
}

.btn-hint {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.85;
}

/* ── 底部 ── */
.footer-note {
  position: relative;
  z-index: 1;
  margin-top: 32px;
  font-size: 13px;
  color: #9e9e9e;
}

.footer-note a {
  color: #7b1fa2;
  text-decoration: none;
  font-weight: 500;
}

.footer-note a:hover {
  text-decoration: underline;
}

/* ── 响应式适配 ── */
@media (max-width: 600px) {
  .welcome {
    padding: 30px 16px;
    justify-content: flex-start;
    padding-top: 12vh;
  }

  .hero-icon { font-size: 56px; }
  .hero-title { font-size: 36px; }
  .hero-subtitle { font-size: 17px; }

  .features {
    flex-direction: column;
    gap: 12px;
  }

  .feature-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    text-align: left;
  }

  .feature-icon {
    margin-bottom: 0;
    font-size: 30px;
    flex-shrink: 0;
  }

  .actions {
    flex-direction: column;
    gap: 12px;
  }

  .btn-user, .btn-admin {
    flex-direction: row;
    justify-content: center;
    gap: 8px;
    padding: 16px 20px;
    font-size: 17px;
  }

  .btn-icon { font-size: 22px; }

  .cloud { font-size: 36px !important; }
}
</style>
