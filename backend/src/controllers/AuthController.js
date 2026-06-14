const AuthService = require('../services/AuthService');

const AuthController = {
  async register(req, res, next) {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  },
  async login(req, res, next) {
    try {
      const result = await AuthService.login(req.body);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
};
module.exports = AuthController;
