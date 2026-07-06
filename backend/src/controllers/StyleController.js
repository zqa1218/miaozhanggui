const StyleService = require('../services/StyleService');

const StyleController = {
  async list(req, res, next) {
    try {
      const styles = await StyleService.list(req.query);
      res.json({ success: true, data: styles });
    } catch (err) { next(err); }
  },

  async detail(req, res, next) {
    try {
      const style = await StyleService.detail(req.params.id);
      res.json({ success: true, data: style });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const style = await StyleService.create(req.body);
      res.status(201).json({ success: true, data: style });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const style = await StyleService.update(req.params.id, req.body);
      res.json({ success: true, data: style });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      await StyleService.remove(req.params.id);
      res.json({ success: true, message: '删除成功' });
    } catch (err) { next(err); }
  },
};

module.exports = StyleController;
