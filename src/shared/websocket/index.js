const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../logger');

class NotificationServer {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.userClients = new Map();   // deviceId → Set<ws>
    this.adminClients = new Map();  // mId → Set<ws>
    this.connect();
    logger.info('[WebSocket] 服务已启动');
  }

  connect() {
    this.wss.on('connection', (ws, req) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token');
        const deviceId = url.searchParams.get('deviceId');

        if (token) {
          try {
            const decoded = jwt.verify(token, config.jwt.secret);
            this.addClient(this.adminClients, decoded.mId, ws);
            logger.info(`[WS] Admin connected: ${decoded.mId}`);
          } catch { ws.close(); return; }
        } else if (deviceId) {
          this.addClient(this.userClients, deviceId, ws);
          logger.info(`[WS] User connected: ${deviceId}`);
        } else {
          ws.close();
          return;
        }

        ws.on('close', () => {
          this.removeClient(this.adminClients, ws);
          this.removeClient(this.userClients, ws);
        });

        // 心跳
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
      } catch { ws.close(); }
    });

    // 每 30s 检查心跳
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
    this.wss.on('close', () => clearInterval(interval));
  }

  addClient(map, key, ws) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(ws);
  }

  removeClient(map, ws) {
    for (const [key, clients] of map) {
      clients.delete(ws);
      if (clients.size === 0) map.delete(key);
    }
  }

  /** 推送给特定用户 */
  notifyUser(deviceId, data) {
    const clients = this.userClients.get(deviceId);
    if (clients) this.sendAll(clients, data);
  }

  /** 推送给商家 */
  notifyMerchant(mId, data) {
    const clients = this.adminClients.get(mId);
    if (clients) this.sendAll(clients, data);
  }

  /** 广播给所有管理员 */
  broadcastAdmin(data) {
    for (const [, clients] of this.adminClients) {
      this.sendAll(clients, data);
    }
  }

  sendAll(clients, data) {
    const msg = JSON.stringify(data);
    clients.forEach((ws) => {
      if (ws.readyState === 1) ws.send(msg);
    });
  }
}

let instance = null;
function init(server) {
  if (!instance) instance = new NotificationServer(server);
  return instance;
}
function get() { return instance; }

module.exports = { init, get };
