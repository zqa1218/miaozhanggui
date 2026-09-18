<script setup>
import { useRouter } from 'vue-router'
import { House, Calendar, Lock, Picture } from '@element-plus/icons-vue'
import mascotStanding from '@/assets/images/mascot-standing.png'

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
    <!-- 背景装饰：只留静态云朵。
         原先还有 5 颗无限闪烁的星星，属于「不传达任何状态的装饰性动效」，
         在工具型界面里是噪音，已移除。 -->
    <div class="decorations" aria-hidden="true">
      <span class="cloud cloud-1">☁️</span>
      <span class="cloud cloud-2">☁️</span>
      <span class="cloud cloud-3">☁️</span>
    </div>

    <!-- 主标题 -->
    <div class="hero">
      <!-- 品牌 IP 形象（设计交付 ip/mascot-standing）替代原先的相机图标 -->
      <img class="hero-mascot" :src="mascotStanding" alt="喵掌柜" width="150" height="182" />
      <h1 class="hero-title">喵掌柜</h1>
      <p class="hero-subtitle">发现你的专属摄影师</p>
      <p class="hero-desc">一站式摄影写真预约平台，轻松预约，定格美好瞬间</p>
    </div>

    <!-- 特色卡片 -->
    <div class="features">
      <div class="feature-card">
        <el-icon class="feature-icon"><House /></el-icon>
        <h3>海量工作室</h3>
        <p>浏览各类风格的摄影工作室，找到最适合你的摄影师</p>
      </div>
      <div class="feature-card">
        <el-icon class="feature-icon"><Calendar /></el-icon>
        <h3>自由选择时段</h3>
        <p>灵活挑选日期和时间，按你的节奏安排拍摄计划</p>
      </div>
      <div class="feature-card">
        <el-icon class="feature-icon"><Lock /></el-icon>
        <h3>安全支付</h3>
        <p>定金锁定预约，拍摄完成再付尾款，资金安全有保障</p>
      </div>
    </div>

    <!-- 按钮组 -->
    <div class="actions">
      <button class="btn-user" @click="goUser">
        <el-icon class="btn-icon"><Picture /></el-icon>
        我是用户
        <span class="btn-hint">浏览工作室，预约拍摄</span>
      </button>
      <button class="btn-admin" @click="goAdmin">
        <el-icon class="btn-icon"><House /></el-icon>
        我是商家
        <span class="btn-hint">管理后台，处理订单</span>
      </button>
    </div>

    <!-- 底部说明 -->
    <p class="footer-note">已注册商家？<a href="/admin/login">登录管理后台</a></p>
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
  padding: var(--space-10) var(--space-5);
  /* 透明：让 body 上的页面背景图（设计交付 page-bg.svg）透出来 */
  background: transparent;
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
  opacity: 0.28;
}
.cloud-1 { top: 8%;  left: 5%;  font-size: 70px; }
.cloud-2 { top: 15%; right: 8%; font-size: 55px; }
.cloud-3 { top: 5%;  left: 55%; font-size: 50px; }

/* ── 主标题 ── */
.hero {
  position: relative;
  z-index: 1;
  margin-bottom: var(--space-10);
}

.hero-mascot {
  display: block;
  margin: 0 auto var(--space-3);
  width: 150px; height: auto;
}

.hero-title {
  font-size: 48px;
  font-weight: 800;
  color: var(--text-1);
  margin: 0 0 var(--space-2);
  letter-spacing: 2px;
}

.hero-subtitle {
  font-size: 20px;
  color: var(--color-primary-ink);
  margin: 0 0 var(--space-3);
  font-weight: 500;
}

.hero-desc {
  font-size: 14px;
  color: var(--text-3);
  margin: 0;
}

/* ── 特色卡片 ── */
.features {
  position: relative;
  z-index: 1;
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-10);
  max-width: 720px;
  width: 100%;
}

.feature-card {
  flex: 1;
  background: var(--surface-1);
  -webkit-backdrop-filter: var(--glass-blur-light);
  backdrop-filter: var(--glass-blur-light);
  border: 1px solid var(--glass-hairline);
  border-radius: var(--radius-card);
  padding: var(--space-6) var(--space-4);
  box-shadow: var(--shadow-1);
  transition: transform var(--duration-2) var(--ease-out),
              box-shadow var(--duration-2) var(--ease-out);
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-2);
}

.feature-icon {
  display: block;
  margin: 0 auto var(--space-2);
  font-size: 32px;
  color: var(--color-primary-ink);
}

.feature-card h3 {
  font-size: 16px;
  color: var(--text-1);
  margin: 0 0 6px;
  font-weight: 600;
}

.feature-card p {
  font-size: 13px;
  color: var(--text-3);
  margin: 0;
  line-height: 1.5;
}

/* ── 按钮 ── */
.actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: var(--space-4);
  max-width: 460px;
  width: 100%;
}

.btn-user, .btn-admin {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-5) var(--space-6);
  border: 1px solid transparent;
  border-radius: var(--radius-card);
  cursor: pointer;
  font-family: inherit;
  font-size: 18px;
  font-weight: 700;
  transition: transform var(--duration-2) var(--ease-out),
              box-shadow var(--duration-2) var(--ease-out),
              background-color var(--duration-1) var(--ease-out);
  position: relative;
  overflow: hidden;
}

/* 主路径：暖杏实底 + 深暖墨字（5.89:1）。
   原为粉紫渐变 + 白字，既跑偏品牌又不达标。 */
.btn-user {
  background: var(--color-primary-gradient);
  color: var(--text-on-primary);
  box-shadow: var(--shadow-primary);
}

/* 次路径：玻璃底，视觉权重明显低于「我是用户」 */
.btn-admin {
  background: var(--surface-1);
  -webkit-backdrop-filter: var(--glass-blur-light);
  backdrop-filter: var(--glass-blur-light);
  border-color: var(--border-color);
  color: var(--text-1);
  box-shadow: var(--shadow-1);
}

.btn-user:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(var(--color-primary-rgb), .30); }
.btn-admin:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); background: var(--color-primary-tint); }

.btn-user:active, .btn-admin:active {
  transform: translateY(0);
}

.btn-icon {
  font-size: 26px;
}
.btn-user .btn-icon { color: var(--text-on-primary); }
.btn-admin .btn-icon { color: var(--color-primary-ink); }

.btn-hint {
  font-size: 12px;
  font-weight: 400;
  opacity: .85;
}

/* ── 底部 ── */
.footer-note {
  position: relative;
  z-index: 1;
  margin-top: var(--space-8);
  font-size: 13px;
  color: var(--text-3);
}

.footer-note a {
  color: var(--color-primary-ink);
  text-decoration: none;
  font-weight: 600;
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

  .hero-mascot { width: 120px; }
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
