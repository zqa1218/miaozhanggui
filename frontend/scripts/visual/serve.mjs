/**
 * 视觉回归用的极简静态服务器
 *
 * 为什么不直接用 `vite preview`：它绑定 vite.config.js、会做额外的转译与
 * 中间件处理，而视觉回归要测的是**最终产物本身**。这里只做三件事：
 *   1. 从 DIST_DIR 提供静态文件
 *   2. 找不到的路径回落到 index.html（SPA 路由）
 *   3. 什么都不改写
 *
 * 用 DIST_DIR 环境变量指定要测哪一份产物 —— 这一条是整个零回归证明的关键：
 * 同一个 spec 先跑改造前的产物存基线，再跑改造后的产物做比对。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const DIST = process.env.DIST_DIR
const PORT = Number(process.env.PORT || 4173)

if (!DIST || !fs.existsSync(DIST)) {
  console.error(`[serve] DIST_DIR 无效：${DIST}`)
  process.exit(1)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0])
  let filePath = path.join(DIST, urlPath)

  // 目录 → index.html；不存在的路径 → SPA 回落
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const asFile = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
      ? path.join(filePath, 'index.html')
      : filePath
    filePath = fs.existsSync(asFile) ? asFile : path.join(DIST, 'index.html')
  }

  try {
    const body = fs.readFileSync(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      // 关闭缓存，避免两次运行之间读到上一次的产物
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[serve] ${DIST} → http://127.0.0.1:${PORT}`)
})
