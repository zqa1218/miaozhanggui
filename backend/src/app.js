const express = require('express');
const cors = require('cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());

// 路由挂载
app.use('/api', routes);

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 & 错误处理
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
