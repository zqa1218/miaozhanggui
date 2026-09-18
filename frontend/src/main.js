import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/theme-chalk/src/index.scss'
import router from './router'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')

// 移除 index.html 里的启动闪屏（淡出后从 DOM 删除，避免残留遮挡）
const splash = document.getElementById('splash')
if (splash) {
  splash.classList.add('is-hidden')
  const drop = () => splash.remove()
  splash.addEventListener('transitionend', drop, { once: true })
  setTimeout(drop, 400) // 兜底：过渡被禁用或无 transitionend 事件时也能移除
}
