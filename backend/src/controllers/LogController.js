const OperationLog = require('../models/OperationLog');

const LogController = {
  async list(req, res, next) {
    try {
      const rows = await OperationLog.findByMId(req.merchant.mId);
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  },
  async create(req, res, next) {
    try {
      await OperationLog.create({ m_id: req.merchant.mId, ...req.body });
      res.json({ success: true, message: '已记录' });
    } catch (err) { next(err); }
  },
  async clear(req, res, next) {
    try {
      await OperationLog.clear(req.merchant.mId);
      res.json({ success: true, message: '已清空' });
    } catch (err) { next(err); }
  },
};
module.exports = LogController;
