const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const { responseMiddleware } = require('./shared/utils/response');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes');
const logger = require('./shared/logger');

//   创建 Express 实例
const app = express();

// ─── 全局中间件 ───
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (config.cors.origins.includes(origin) || config.env === 'development') {
      return callback(null, true);
    }
    callback(new Error('CORS not allowed'));
  },
  credentials: true,
}));

//   请求日志
app.use(morgan('short', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

//   Body 解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

//   静态文件服务（上传的图片）
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

//   统一响应 helper
app.use(responseMiddleware);

// ─── 路由 ───
app.use('/api', routes);

// ─── 404 处理 ───
app.use((_req, res) => {
  res.status(404).json({ success: false, data: null, message: '接口不存在' });
});

// ─── 全局错误处理（必须放在最后） ───
app.use(errorHandler);

module.exports = app;
