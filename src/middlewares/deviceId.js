/**
 * DeviceId 提取中间件
 * 从 Header/Query/Body 中提取，无则自动生成（兼容 B 端管理上传）
 */
function deviceIdMiddleware(req, res, next) {
  let deviceId =
    req.headers['x-device-id'] ||
    req.query.userDeviceId ||
    req.body.userDeviceId ||
    '';

  if (!deviceId) {
    // 自动生成：B 端管理上传无 x-device-id，使用 token hash 或随机值
    deviceId = 'srv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  req.deviceId = deviceId;
  next();
}

module.exports = deviceIdMiddleware;
