const service = require('./merchant.service');
const logger = require('../../shared/logger');

/** POST /register */
async function register(req, res) {
  try {
    const result = await service.register(req.body);
    res.rh.success(result, result.message);
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('register error', err);
    res.rh.error('注册失败');
  }
}

/** POST /login */
async function login(req, res) {
  try {
    const result = await service.login(req.body);
    res.rh.success(result, '登录成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 401);
    logger.error('login error', err);
    res.rh.error('登录失败');
  }
}

/** POST /change-password */
async function changePassword(req, res) {
  try {
    await service.changePassword(req.user.mId, req.body);
    res.rh.success(null, '密码修改成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('changePassword error', err);
    res.rh.error('修改密码失败');
  }
}

/** GET /profile */
async function getProfile(req, res) {
  try {
    const result = await service.getProfile(req.user.mId);
    res.rh.success(result);
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('getProfile error', err);
    res.rh.error('获取信息失败');
  }
}

/** PUT /profile */
async function updateProfile(req, res) {
  try {
    const result = await service.updateProfile(req.user.mId, req.body);
    res.rh.success(result, '更新成功');
  } catch (err) {
    if (err.isOperational) return res.rh.fail(err.message, err.statusCode || 400);
    logger.error('updateProfile error', err);
    res.rh.error('更新失败');
  }
}

module.exports = { register, login, changePassword, getProfile, updateProfile };
