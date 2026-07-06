const Style = require('../models/Style');
const { AppError } = require('../middleware/errorHandler');

const StyleService = {
  async list({ status } = {}) {
    return Style.findAll({ status });
  },

  async detail(id) {
    const style = await Style.findById(id);
    if (!style) throw new AppError('样式不存在', 404, 'STYLE_NOT_FOUND');
    return style;
  },

  async create(data) {
    return Style.create(data);
  },

  async update(id, data) {
    await this.detail(id); // 确保存在
    return Style.update(id, data);
  },

  async remove(id) {
    await this.detail(id);
    return Style.delete(id);
  },
};

module.exports = StyleService;
