<script setup>
/**
 * 首页 · glass 主题
 * ---------------------------------------------------------------
 * 只在 `data-theme="glass"` 时渲染（见 views/WelcomeView.vue 的分支）。
 * classic 主题的首页是另一套结构，保持逐像素不变。
 *
 * ── 玻璃容器预算：5 / 5（用满，不再新增）──
 *   ① .gh-nav          顶部导航条        .glass
 *   ② .gh-search       Hero 搜索条       .glass-strong
 *   ③④⑤ .gh-feature ×3  三张能力卡        .glass-quiet
 * 其余全部用实色/半实色表面：工作室卡片（照片必须实色，否则模糊层毁画质）、
 * 信任区、底部 CTA、Footer。Footer 用最深一档表面。
 *
 * ── LCP 元素 ──
 *   Hero 的 <h1>喵掌柜</h1>。三条保证：
 *     1. 首屏没有任何 <img>：品牌标是**内联 SVG**（v-html），内联 SVG 不参与
 *        LCP 候选，只有 <img>/<image>/background-image/video poster 才参与；
 *     2. Hero 没有背景图，背景是 body::before/::after 上的纯 CSS 图层；
 *     3. 原 classic 首页的吉祥物位图 95.6 KB 未进入 glass 首屏。
 *   结果是首屏唯一的大面积绘制内容就是文本块。
 *
 * ── 搜索条是**视觉占位**，不是可用筛选器 ──
 *   原因：/studio-filter 目前不读取任何查询参数（它只有内部状态）。
 *   要让它真正生效，需要先给 StudioFilter 加 query 支持 —— 那是独立任务。
 *   这里三个输入框是 readonly 的真实 <input>（可聚焦、有光标、文字可读），
 *   整条提交后跳到 /studio-filter。已在交付说明中标注，未伪造筛选能力。
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useStudioStore } from '@/stores/studio'
import { useTheme } from '@/composables/useTheme'
import SvgIcon from '@/components/shared/SvgIcon.vue'
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'
import logoIcon from '@/assets/images/logo-icon.svg?raw'
import placeholder4x3 from '@/assets/images/placeholder-4x3.svg'

const router = useRouter()
const store = useStudioStore()
useTheme() // 订阅主题：切回 classic 时本组件会被卸载，这里保证订阅在作用域内

/* ── 推荐区块：真实数据，取前 8 个 ── */
const featured = computed(() => (store.list || []).slice(0, 8))
const cityCount = computed(() => {
  const set = new Set()
  ;(store.list || []).forEach((s) => s.city && set.add(s.city))
  return set.size
})
const studioCount = computed(() => (store.list || []).length)

onMounted(() => {
  // C 端公开精简列表，无需鉴权；失败时静默 —— 推荐区会退化为骨架/空态，
  // 不影响 Hero 与导航，首页依然可用。
  store.fetchLiteList()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

/* ── 移动端导航浮层 ── */
const menuOpen = ref(false)
function onKeydown(e) {
  if (e.key === 'Escape' && menuOpen.value) menuOpen.value = false
}

const NAV_LINKS = [
  { label: '工作室', to: '/studios' },
  { label: '风格', to: '/styles' },
]

function go(path) {
  menuOpen.value = false
  router.push(path)
}
function goFilter() {
  router.push('/studio-filter')
}
function goStudio(id) {
  router.push(`/studios/${id}`)
}
</script>

<template>
  <div class="gh">
    <!-- ════════ ① 顶部导航 · 玻璃容器 1/5 ════════ -->
    <header class="gh-nav glass">
      <!-- 品牌标用内联 SVG：矢量、随文字色、且不参与 LCP 候选 -->
      <a class="gh-brand" href="/" @click.prevent="go('/')">
        <span class="gh-brand__mark" v-html="logoIcon" aria-hidden="true"></span>
        <span class="gh-brand__name">喵掌柜</span>
      </a>

      <nav class="gh-nav__links" aria-label="主导航">
        <button v-for="l in NAV_LINKS" :key="l.to" type="button" class="gh-nav__link" @click="go(l.to)">
          {{ l.label }}
        </button>
      </nav>

      <div class="gh-nav__actions">
        <ThemeSwitcher />
        <button type="button" class="gh-nav__login" @click="go('/admin/login')">商家登录</button>
        <button
          type="button"
          class="gh-nav__burger"
          :aria-expanded="menuOpen"
          aria-controls="gh-mobile-menu"
          aria-label="导航菜单"
          @click="menuOpen = !menuOpen"
        >
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>

    <!-- 移动端浮层导航 -->
    <Teleport to="body">
      <div v-if="menuOpen" class="gh-sheet" @click.self="menuOpen = false">
        <div id="gh-mobile-menu" class="gh-sheet__panel" role="dialog" aria-modal="true" aria-label="导航菜单">
          <div class="gh-sheet__hd">
            <span class="gh-brand__name">喵掌柜</span>
            <button type="button" class="gh-sheet__close" aria-label="关闭菜单" @click="menuOpen = false">&times;</button>
          </div>
          <button v-for="l in NAV_LINKS" :key="l.to" type="button" class="gh-sheet__item" @click="go(l.to)">
            {{ l.label }}
          </button>
          <button type="button" class="gh-sheet__item" @click="go('/studio-filter')">开始预约</button>
          <button type="button" class="gh-sheet__item" @click="go('/admin/login')">商家登录</button>

          <!-- 与导航条里是**同一个组件**，只是换成竖排呈现。
               浮层里额外多一个「恢复默认」—— 导航条上空间要留给主操作。 -->
          <div class="gh-sheet__section">
            <ThemeSwitcher variant="sheet" />
          </div>
        </div>
      </div>
    </Teleport>

    <main class="gh-main">
      <!-- ════════ Hero ════════ -->
      <section class="gh-hero">
        <!-- LCP 元素：这一块文本是首屏最大的绘制内容 -->
        <h1 class="gh-hero__title">喵掌柜</h1>
        <p class="gh-hero__sub">发现你的专属摄影师</p>
        <p class="gh-hero__desc">一站式摄影写真预约平台，轻松预约，定格美好瞬间</p>

        <!-- ════════ ② Hero 搜索条 · 玻璃容器 2/5 ════════
             首页最重要的玻璃组件：它是视觉焦点，也是唯一的转化入口。
             用 .glass-strong（高填充）而非 .glass —— 内部要承载输入控件，
             底色越实，文字与光标越稳。 -->
        <form class="gh-search glass-strong" @submit.prevent="goFilter">
          <div class="gh-search__fields">
            <label class="gh-field">
              <span class="gh-field__label">地点</span>
              <input class="gh-field__input" type="text" readonly placeholder="全部城市" tabindex="0" />
            </label>
            <span class="gh-field__sep" aria-hidden="true"></span>
            <label class="gh-field">
              <span class="gh-field__label">拍摄风格</span>
              <input class="gh-field__input" type="text" readonly placeholder="全部风格" tabindex="0" />
            </label>
            <span class="gh-field__sep" aria-hidden="true"></span>
            <label class="gh-field">
              <span class="gh-field__label">日期</span>
              <input class="gh-field__input" type="text" readonly placeholder="选择日期" tabindex="0" />
            </label>
          </div>
          <button type="submit" class="gh-search__submit">
            <SvgIcon name="icon-camera" :size="18" />
            <span>开始预约</span>
          </button>
        </form>
        <p class="gh-hero__note">前往工作室列表，按城市、风格与日期筛选</p>
      </section>

      <!-- ════════ ③④⑤ 三张核心能力卡 · 玻璃容器 3–5/5 ════════ -->
      <section class="gh-features" aria-label="平台能力">
        <article class="gh-feature glass-quiet">
          <span class="gh-feature__icon"><SvgIcon name="icon-grid" :size="24" /></span>
          <h3>海量工作室</h3>
          <p>浏览各类风格的摄影工作室，找到最适合你的摄影师</p>
        </article>
        <article class="gh-feature glass-quiet">
          <span class="gh-feature__icon"><SvgIcon name="icon-calendar" :size="24" /></span>
          <h3>自由选择时段</h3>
          <p>灵活挑选日期和时间，按你的节奏安排拍摄计划</p>
        </article>
        <article class="gh-feature glass-quiet gh-feature--accent">
          <span class="gh-feature__icon"><SvgIcon name="icon-shield-check" :size="24" /></span>
          <h3>安全支付</h3>
          <p>定金锁定预约，拍摄完成再付尾款，资金安全有保障</p>
        </article>
      </section>

      <!-- ════════ 推荐工作室 · 实色卡片 ════════
           照片区域必须实色：玻璃覆盖层会压暗照片、加一层灰雾，直接毁画质。
           信息条同样用实色 —— 照片是主角，玻璃是舞台。 -->
      <section class="gh-section" aria-labelledby="gh-studios-title">
        <div class="gh-section__hd">
          <h2 id="gh-studios-title" class="gh-section__title">推荐工作室</h2>
          <button type="button" class="gh-section__more" @click="go('/studios')">查看全部</button>
        </div>

        <div v-if="store.loading && !featured.length" class="gh-grid">
          <div v-for="n in 4" :key="n" class="gh-card gh-card--skeleton" aria-hidden="true">
            <div class="gh-card__photo"></div>
            <div class="gh-card__info"><span class="gh-sk gh-sk--t"></span><span class="gh-sk gh-sk--m"></span></div>
          </div>
        </div>

        <div v-else-if="!featured.length" class="gh-empty">
          <p>还没有上架的工作室</p>
          <button type="button" class="gh-empty__btn" @click="go('/studio-filter')">去看看</button>
        </div>

        <div v-else class="gh-grid">
          <article v-for="s in featured" :key="s.id" class="gh-card">
            <button type="button" class="gh-card__hit" :aria-label="`查看 ${s.title}`" @click="goStudio(s.id)"></button>
            <div class="gh-card__photo">
              <img
                v-if="s.coverUrl"
                :src="s.coverUrl"
                :alt="s.title"
                loading="lazy"
                decoding="async"
              />
              <img v-else :src="placeholder4x3" alt="" loading="lazy" decoding="async" />
            </div>
            <div class="gh-card__info">
              <h3 class="gh-card__title">{{ s.title }}</h3>
              <p v-if="s.city" class="gh-card__city">{{ s.city }}</p>
              <p class="gh-card__price">
                <span v-if="s.singlePrice" class="gh-num">¥{{ s.singlePrice }}</span>
                <span v-if="s.singlePrice" class="gh-card__unit">/张</span>
                <span v-if="s.packagePrice" class="gh-card__pkg">套餐 <span class="gh-num">¥{{ s.packagePrice }}</span></span>
              </p>
            </div>
          </article>
        </div>
      </section>

      <!-- ════════ 信任区 · 只用可核实的事实 ════════
           刻意**不做**用户评价：项目没有评价数据源，编造评价属造假。
           这里每一项都能从接口或既有业务规则核实。 -->
      <section class="gh-section" aria-labelledby="gh-trust-title">
        <h2 id="gh-trust-title" class="gh-section__title">为什么用喵掌柜</h2>
        <dl class="gh-trust">
          <div class="gh-trust__item">
            <dt>可选工作室</dt>
            <dd class="gh-num">{{ studioCount || '—' }}</dd>
          </div>
          <div class="gh-trust__item">
            <dt>覆盖城市</dt>
            <dd class="gh-num">{{ cityCount || '—' }}</dd>
          </div>
          <div class="gh-trust__item">
            <dt>付款方式</dt>
            <dd>定金锁档 · 尾款结清</dd>
          </div>
          <div class="gh-trust__item">
            <dt>时段保护</dt>
            <dd>下单即锁档，重复预约自动拦截</dd>
          </div>
        </dl>
      </section>

      <!-- ════════ 底部 CTA · 实色，无玻璃 ════════ -->
      <section class="gh-cta">
        <h2 class="gh-cta__title">准备好拍一组了吗</h2>
        <p class="gh-cta__desc">挑一个工作室，选个合适的时间</p>
        <div class="gh-cta__actions">
          <button type="button" class="gh-btn gh-btn--primary" @click="go('/studio-filter')">开始预约</button>
          <button type="button" class="gh-btn gh-btn--ghost" @click="go('/my-orders')">我的订单</button>
        </div>
      </section>
    </main>

    <!-- ════════ Footer · 最深一档表面，明确不加玻璃 ════════ -->
    <footer class="gh-footer">
      <div class="gh-footer__inner">
        <div class="gh-footer__brand">
          <span class="gh-footer__mark" v-html="logoIcon" aria-hidden="true"></span>
          <div>
            <p class="gh-footer__name">喵掌柜</p>
            <p class="gh-footer__slogan">摄影写真预约平台</p>
          </div>
        </div>
        <nav class="gh-footer__links" aria-label="页脚导航">
          <button type="button" @click="go('/studios')">工作室</button>
          <button type="button" @click="go('/styles')">风格</button>
          <button type="button" @click="go('/my-orders')">我的订单</button>
          <button type="button" @click="go('/admin/login')">商家登录</button>
        </nav>
      </div>
      <p class="gh-footer__legal">© {{ new Date().getFullYear() }} 喵掌柜</p>
    </footer>
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════════
   页面骨架
   ══════════════════════════════════════════════════════════════ */
.gh {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  /* 透明：让 body::before/::after 的光斑与网格透上来 */
  background: transparent;
}

.gh-main {
  flex: 1;
  width: 100%;
  max-width: var(--w-wide);
  margin: 0 auto;
  padding: 0 var(--gutter) var(--space-12);
}

/* ══════════════════════════════════════════════════════════════
   ① 顶部导航 · 悬浮胶囊
   ══════════════════════════════════════════════════════════════ */
.gh-nav {
  position: sticky;
  top: 12px;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: calc(100% - var(--gutter) * 2);
  max-width: calc(var(--w-wide) - var(--gutter) * 2);
  margin: 12px auto var(--space-8);
  padding: 10px 12px 10px 18px;
  border-radius: var(--radius-pill);
}

.gh-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--text-1);
  flex-shrink: 0;
}
/* 品牌链接也要有显式焦点环。浏览器默认的 outline:auto 在 Chromium 上是
   1px 的自动描边，落在磨砂玻璃上不够明确 —— 键盘用户会看不到自己在哪。 */
.gh-brand:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}
.gh-brand__mark { display: inline-flex; width: 28px; height: 28px; line-height: 0; }
.gh-brand__mark :deep(svg) { width: 100%; height: 100%; display: block; }
.gh-brand__name { font-size: 17px; font-weight: 800; letter-spacing: .04em; }

.gh-nav__links { display: flex; gap: 2px; flex: 1; }
.gh-nav__link {
  height: 34px; padding: 0 16px;
  border: none; background: none;
  border-radius: var(--radius-pill);
  font-family: inherit; font-size: 14px; font-weight: 600;
  color: var(--text-2); cursor: pointer;
  transition: color var(--duration-1) var(--ease-out),
              background-color var(--duration-1) var(--ease-out);
}
.gh-nav__link:hover { color: var(--brand); background: var(--color-primary-tint); }
.gh-nav__link:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

.gh-nav__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.gh-nav__login {
  height: 34px; padding: 0 16px;
  border: none; border-radius: var(--radius-pill);
  background: var(--color-primary-gradient);
  color: var(--text-on-primary);
  font-family: inherit; font-size: 13px; font-weight: 700;
  cursor: pointer; white-space: nowrap;
  box-shadow: var(--shadow-primary);
  transition: transform var(--duration-1) var(--ease-out);
}
.gh-nav__login:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.gh-nav__login:active { transform: translateY(1px); }

.gh-nav__burger {
  display: none;
  width: 34px; height: 34px;
  border: 1px solid var(--glass-stroke);
  border-radius: var(--radius-pill);
  background: none; cursor: pointer;
  padding: 0;
  flex-direction: column; align-items: center; justify-content: center; gap: 3px;
}
.gh-nav__burger span {
  display: block; width: 14px; height: 1.5px;
  background: var(--text-2); border-radius: 2px;
}
.gh-nav__burger:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* ── 移动端浮层菜单 ── */
.gh-sheet {
  position: fixed; inset: 0; z-index: 2000; /* 高于 --z-toast，低于 EP 弹层 */
  background: var(--scrim);
  display: flex; justify-content: flex-end;
}
.gh-sheet__panel {
  width: min(78vw, 300px);
  height: 100%;
  background: var(--surface-solid);
  border-left: 1px solid var(--glass-stroke);
  padding: var(--space-5) var(--space-4);
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
}
.gh-sheet__hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 8px var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: var(--space-3);
}
.gh-sheet__close {
  width: 32px; height: 32px;
  border: none; background: none; cursor: pointer;
  font-size: 24px; line-height: 1; color: var(--text-2);
  border-radius: var(--radius-sm);
}
.gh-sheet__close:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.gh-sheet__item {
  height: 44px; padding: 0 12px;
  border: none; background: none; text-align: left;
  border-radius: var(--radius-md);
  font-family: inherit; font-size: 15px; font-weight: 600;
  color: var(--text-1); cursor: pointer;
}
.gh-sheet__item:hover { background: var(--color-primary-tint); }
.gh-sheet__item:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }

/* 浮层里的主题切换：与上面的导航项用一条分隔线区分开 ——
   它们性质不同（上面是「去哪」，这里是「换个样子」）。 */
.gh-sheet__section {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
}

/* ══════════════════════════════════════════════════════════════
   Hero
   ══════════════════════════════════════════════════════════════ */
.gh-hero {
  text-align: center;
  padding: var(--space-10) 0 var(--space-12);
}

.gh-hero__title {
  font-size: 56px;
  font-weight: 800;
  letter-spacing: .06em;
  line-height: 1.1;
  margin: 0 0 var(--space-3);
  color: var(--text-1);
}
.gh-hero__sub {
  font-size: 20px; font-weight: 600;
  margin: 0 0 var(--space-2);
  color: var(--brand);
}
.gh-hero__desc {
  font-size: 15px;
  margin: 0;
  color: var(--text-2);
}

.gh-hero__note {
  margin: var(--space-3) 0 0;
  font-size: 12px;
  color: var(--text-3);
}

/* ══════════════════════════════════════════════════════════════
   ② Hero 搜索条 · 玻璃容器 2/5
   ══════════════════════════════════════════════════════════════ */
.gh-search {
  display: flex;
  align-items: stretch;
  gap: var(--space-2);
  max-width: 760px;
  margin: var(--space-8) auto 0;
  padding: 8px 8px 8px 4px;
  border-radius: var(--radius-pill);
}

.gh-search__fields { display: flex; flex: 1; align-items: center; min-width: 0; }

.gh-field {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 16px;
  cursor: text;
}

.gh-field__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .04em;
  color: var(--text-3);
}

/* 输入控件用**实色高不透明**表面（--surface-solid），与背后的玻璃分离：
   玻璃底上的半透明输入框会让文字与光标随背光变化，读写都吃力。 */
.gh-field__input {
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  outline: none;
  text-overflow: ellipsis;
}
.gh-field__input::placeholder { color: var(--text-3); font-weight: 500; }

/* ⚠ 输入框上写了 outline:none，就必须补一个替代的焦点环 ——
   否则键盘用户看不到焦点在哪（这是阶段 3 漏掉的，被焦点可见性测试抓出来）。
   环画在 input 自身而不是外层 .gh-field 上：不依赖 :has()，所有浏览器一致。 */
.gh-field__input:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 1px;
  border-radius: var(--radius-xs);
}
.gh-field:focus-within { background: var(--surface-solid); border-radius: var(--radius-md); }
.gh-field:focus-within .gh-field__label { color: var(--brand); }

.gh-field__sep {
  width: 1px;
  align-self: stretch;
  margin: 8px 0;
  background: var(--border-subtle);
  flex-shrink: 0;
}

.gh-search__submit {
  display: inline-flex; align-items: center; gap: 6px;
  flex-shrink: 0;
  padding: 0 24px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--color-primary-gradient);
  color: var(--text-on-primary);
  font-family: inherit; font-size: 15px; font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-primary);
  transition: transform var(--duration-1) var(--ease-out);
}
.gh-search__submit:focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; }
.gh-search__submit:active { transform: translateY(1px); }

/* ══════════════════════════════════════════════════════════════
   ③④⑤ 三张能力卡 · 玻璃容器 3–5/5
   hover：只动 transform 与伪元素的 opacity。
   设计要求里写的是「上浮 + 阴影加深」，但同一条又明确禁止动画 box-shadow。
   两者兼顾的做法：把更深的阴影放在 ::after 上，hover 时只过渡它的 opacity ——
   视觉上阴影「渐显」，性能上只有合成属性在动。
   ══════════════════════════════════════════════════════════════ */
.gh-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  margin-bottom: var(--space-12);
}

.gh-feature {
  position: relative;
  padding: var(--space-6) var(--space-5);
}
.gh-feature::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  box-shadow: var(--shadow-3);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-2) var(--ease-out);
}

/* 触屏没有 hover：用 (hover: hover) 兜住，避免「点一下卡住高亮」 */
@media (hover: hover) {
  .gh-feature { transition: transform var(--duration-2) var(--ease-out); }
  .gh-feature:hover { transform: translateY(-2px); }
  .gh-feature:hover::after { opacity: 1; }
}

.gh-feature__icon {
  display: inline-flex;
  width: 44px; height: 44px;
  align-items: center; justify-content: center;
  margin-bottom: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-primary-tint);
  color: var(--brand);
}

.gh-feature h3 {
  margin: 0 0 6px;
  font-size: 16px; font-weight: 700;
  color: var(--text-1);
}
.gh-feature p {
  margin: 0;
  font-size: 13px; line-height: 1.6;
  color: var(--text-2);
}

/* 「安全支付」的克制强调：顶部一条渐变细线 + 图标底的一层柔光。
   刻意不做成促销横幅 —— 它只是三张卡里视觉权重略高的那一张。 */
.gh-feature--accent::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--brand), transparent);
  opacity: .55;
}
.gh-feature--accent .gh-feature__icon {
  background: linear-gradient(140deg, var(--color-primary-tint), transparent 70%);
  box-shadow: 0 0 0 6px rgba(var(--color-primary-rgb), .06);
}

/* ══════════════════════════════════════════════════════════════
   区块通用
   ══════════════════════════════════════════════════════════════ */
.gh-section { margin-bottom: var(--space-12); }

.gh-section__hd {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.gh-section__title {
  margin: 0;
  font-size: 22px; font-weight: 800;
  color: var(--text-1);
  letter-spacing: .02em;
}
.gh-section__more {
  border: none; background: none; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 700;
  color: var(--brand);
  padding: 6px 10px; border-radius: var(--radius-pill);
}
.gh-section__more:hover { background: var(--color-primary-tint); }
.gh-section__more:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* ══════════════════════════════════════════════════════════════
   推荐工作室 · 实色卡片
   ══════════════════════════════════════════════════════════════ */
.gh-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-5);
}

.gh-card {
  position: relative;
  display: flex; flex-direction: column;
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  overflow: hidden;
  transition: transform var(--duration-2) var(--ease-out),
              border-color var(--duration-2) var(--ease-out);
}
@media (hover: hover) {
  .gh-card:hover { transform: translateY(-2px); border-color: var(--brand); }
}

/* 整卡可点：用一个覆盖全卡的 button 承载点击与键盘焦点，
   这样读屏只会遇到一个可聚焦元素，而不是卡片里散落多个。 */
.gh-card__hit {
  position: absolute; inset: 0; z-index: 2;
  border: none; background: none; cursor: pointer;
  border-radius: inherit;
}
.gh-card__hit:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: -3px;
}

/* 照片区：固定宽高比 + 实色底。宽高比锁死是 CLS < 0.05 的关键 ——
   图片加载完成后不会把下方内容顶下去。 */
.gh-card__photo {
  aspect-ratio: 4 / 3;
  width: 100%;
  background: var(--bg-sunken);
  overflow: hidden;
}
.gh-card__photo img {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}

.gh-card__info {
  padding: var(--space-4) var(--space-4) var(--space-5);
  display: flex; flex-direction: column; gap: 4px;
}
.gh-card__title {
  margin: 0;
  font-size: 15px; font-weight: 700;
  color: var(--text-1);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gh-card__city { margin: 0; font-size: 12px; color: var(--text-3); }
.gh-card__price {
  margin: 4px 0 0;
  display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;
  font-size: 14px; color: var(--brand); font-weight: 700;
}
.gh-card__unit { font-size: 11px; color: var(--text-3); font-weight: 500; }
.gh-card__pkg {
  font-size: 11px; font-weight: 600;
  color: var(--text-3);
  padding: 2px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
}

/* 等宽数字：价格与时间在列表里逐行对齐，避免数字宽度差异造成跳动 */
.gh-num { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }

/* 骨架屏：只占位，不做闪烁动画（那属于「不传达状态的装饰性动效」） */
.gh-card--skeleton { pointer-events: none; }
.gh-sk { display: block; height: 12px; border-radius: var(--radius-xs); background: var(--bg-sunken); }
.gh-sk--t { width: 60%; }
.gh-sk--m { width: 40%; margin-top: 8px; }

.gh-empty {
  text-align: center;
  padding: var(--space-10) var(--space-4);
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  color: var(--text-3);
}
.gh-empty p { margin: 0 0 var(--space-4); }
.gh-empty__btn {
  height: 36px; padding: 0 22px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-btn);
  background: var(--surface-solid);
  color: var(--text-1);
  font-family: inherit; font-size: 14px; font-weight: 600;
  cursor: pointer;
}
.gh-empty__btn:hover { border-color: var(--brand); color: var(--brand); }
.gh-empty__btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* ══════════════════════════════════════════════════════════════
   信任区 · 实色
   ══════════════════════════════════════════════════════════════ */
.gh-trust {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin: 0;
}
.gh-trust__item {
  padding: var(--space-5) var(--space-4);
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
}
.gh-trust__item dt {
  font-size: 12px; font-weight: 600;
  color: var(--text-3);
  margin-bottom: 6px;
}
.gh-trust__item dd {
  margin: 0;
  font-size: 15px; font-weight: 700;
  color: var(--text-1);
}

/* ══════════════════════════════════════════════════════════════
   底部 CTA · 实色，无玻璃
   ══════════════════════════════════════════════════════════════ */
.gh-cta {
  padding: var(--space-10) var(--space-6);
  text-align: center;
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
}
.gh-cta__title { margin: 0 0 6px; font-size: 22px; font-weight: 800; color: var(--text-1); }
.gh-cta__desc { margin: 0 0 var(--space-6); font-size: 14px; color: var(--text-2); }
.gh-cta__actions { display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap; }

.gh-btn {
  height: 44px; padding: 0 28px;
  border-radius: var(--radius-btn);
  font-family: inherit; font-size: 15px; font-weight: 700;
  cursor: pointer;
  transition: transform var(--duration-1) var(--ease-out),
              background-color var(--duration-1) var(--ease-out),
              border-color var(--duration-1) var(--ease-out);
}
.gh-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.gh-btn:active { transform: translateY(1px); }

.gh-btn--primary {
  border: none;
  background: var(--color-primary-gradient);
  color: var(--text-on-primary);
  box-shadow: var(--shadow-primary);
}
.gh-btn--ghost {
  border: 1px solid var(--border-color);
  background: var(--surface-solid);
  color: var(--text-1);
}
.gh-btn--ghost:hover { border-color: var(--brand); color: var(--brand); }

/* ══════════════════════════════════════════════════════════════
   Footer · 最深一档表面，明确不加玻璃
   ══════════════════════════════════════════════════════════════ */
.gh-footer {
  margin-top: auto;
  background: var(--surface-deep);
  color: var(--text-inverse);
  padding: var(--space-8) var(--gutter) var(--space-6);
}
.gh-footer__inner {
  max-width: var(--w-wide);
  margin: 0 auto;
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: var(--space-6); flex-wrap: wrap;
}
.gh-footer__brand { display: flex; align-items: center; gap: 10px; }
.gh-footer__mark { display: inline-flex; width: 32px; height: 32px; line-height: 0; }
.gh-footer__mark :deep(svg) { width: 100%; height: 100%; display: block; }
.gh-footer__name { margin: 0; font-size: 16px; font-weight: 800; }
.gh-footer__slogan { margin: 2px 0 0; font-size: 12px; opacity: .72; }

.gh-footer__links { display: flex; gap: var(--space-5); flex-wrap: wrap; }
.gh-footer__links button {
  border: none; background: none; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600;
  color: var(--text-inverse); opacity: .78;
  padding: 4px 2px;
}
.gh-footer__links button:hover { opacity: 1; text-decoration: underline; }
.gh-footer__links button:focus-visible { outline: 2px solid var(--text-inverse); outline-offset: 3px; }

.gh-footer__legal {
  max-width: var(--w-wide);
  margin: var(--space-6) auto 0;
  padding-top: var(--space-4);
  border-top: 1px solid var(--divider-on-deep);
  font-size: 12px;
  opacity: .62;
}

/* ══════════════════════════════════════════════════════════════
   响应式
   ══════════════════════════════════════════════════════════════ */
@media (max-width: 1023px) {
  .gh-grid { grid-template-columns: repeat(3, 1fr); }
  .gh-hero__title { font-size: 48px; }
}

@media (max-width: 767px) {
  .gh-nav { gap: var(--space-2); padding: 8px 8px 8px 14px; }
  .gh-nav__links { display: none; }
  .gh-nav__burger { display: flex; }
  .gh-nav__login { display: none; }   /* 浮层里有入口，横排空间留给品牌与开关 */

  .gh-hero { padding: var(--space-6) 0 var(--space-8); }
  .gh-hero__title { font-size: 38px; }
  .gh-hero__sub { font-size: 17px; }

  /* 搜索条在窄屏改为纵向堆叠：横排三列在 375px 上每列只剩 ~90px，
     标签和占位文字都会被截断。 */
  .gh-search {
    flex-direction: column;
    align-items: stretch;
    border-radius: var(--radius-card);
    padding: var(--space-2);
  }
  .gh-search__fields { flex-direction: column; align-items: stretch; }
  .gh-field { padding: 10px 14px; }
  .gh-field:focus-within { background: var(--surface-solid); }
  .gh-field__sep { width: auto; height: 1px; margin: 0 14px; align-self: auto; }
  .gh-search__submit { height: 48px; justify-content: center; margin-top: var(--space-2); }

  .gh-features { grid-template-columns: 1fr; gap: var(--space-3); }
  .gh-feature { padding: var(--space-5) var(--space-4); }

  .gh-grid { grid-template-columns: repeat(2, 1fr); gap: var(--space-3); }
  .gh-trust { grid-template-columns: repeat(2, 1fr); gap: var(--space-3); }

  .gh-section__title { font-size: 19px; }
  .gh-cta { padding: var(--space-8) var(--space-4); }
  .gh-btn { width: 100%; }

  .gh-footer__inner { flex-direction: column; gap: var(--space-5); }
}

@media (max-width: 479px) {
  .gh-grid { grid-template-columns: 1fr; }
  .gh-hero__title { font-size: 34px; letter-spacing: .04em; }
  .gh-trust { grid-template-columns: 1fr; }
}
</style>
