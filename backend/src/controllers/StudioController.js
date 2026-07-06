const StudioService = require('../services/StudioService');

const StudioController = {
  // GET /api/studios
  async list(req, res, next) {
    try {
      const studios = await StudioService.list(req.query);
      res.json({ success: true, data: studios });
    } catch (err) { next(err); }
  },

  // GET /api/studios/:id
  async detail(req, res, next) {
    try {
      const studio = await StudioService.detail(req.params.id);
      res.json({ success: true, data: studio });
    } catch (err) { next(err); }
  },

  /**
   * POST /api/add-studio
   *
   * 创建项目，含样式开关校验:
   * - is_style_enabled=true  → 校验 style_ids 中的样式是否存在且启用
   * - is_style_enabled=false → 校验并写入原生单张/套餐定价 + 耗时规则
   */
  async addStudio(req, res, next) {
    try {
      const studio = await StudioService.create(req.body);
      res.status(201).json({ success: true, data: studio });
    } catch (err) { next(err); }
  },

  // PUT /api/studios/:id
  async update(req, res, next) {
    try {
      const studio = await StudioService.update(req.params.id, req.body);
      res.json({ success: true, data: studio });
    } catch (err) { next(err); }
  },

  // DELETE /api/studios/:id
  async remove(req, res, next) {
    try {
      await StudioService.remove(req.params.id);
      res.json({ success: true, message: '删除成功' });
    } catch (err) { next(err); }
  },
};

module.exports = StudioController;
