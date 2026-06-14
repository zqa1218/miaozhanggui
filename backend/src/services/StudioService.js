const Studio = require('../models/Studio');
const Style = require('../models/Style');
const StudioStyleRelation = require('../models/StudioStyleRelation');
const { AppError } = require('../middleware/errorHandler');

const StudioService = {
  async list(filters = {}) {
    return Studio.findAll(filters);
  },

  async detail(id) {
    const studio = await Studio.findById(id);
    if (!studio) throw new AppError('项目不存在', 404, 'STUDIO_NOT_FOUND');
    if (studio.is_style_enabled) {
      studio.styles = await StudioStyleRelation.findByStudio(id);
    }
    return studio;
  },

  /**
   * 创建项目 — 含完整校验逻辑
   *
   * 校验规则:
   * 1. is_style_enabled=true → style_ids 须全部存在于 styles 表且 status=1
   * 2. is_style_enabled=false → pricing_model 须匹配 pricing 字段，
   *    单张须填 single_price + 耗时规则，套餐须填 package_* + 耗时规则
   */
  async create(data) {
    const { is_style_enabled, style_ids, pricing_model, ...rest } = data;

    // ---- 样式模式校验 ----
    if (is_style_enabled) {
      if (!style_ids || !Array.isArray(style_ids) || style_ids.length === 0) {
        throw new AppError('开启样式模式后必须选择至少一个样式', 400, 'STYLE_IDS_REQUIRED');
      }
      // 校验 style_ids 全部合法
      const validStyles = await Style.findAll({ status: 1 });
      const validIds = new Set(validStyles.map(s => s.id));
      const invalidIds = style_ids.filter(id => !validIds.has(id));
      if (invalidIds.length > 0) {
        throw new AppError(`样式 ${invalidIds.join(', ')} 不存在或已禁用`, 400, 'INVALID_STYLE_IDS');
      }
    }

    // ---- 定价模式校验 ----
    if (!is_style_enabled || pricing_model !== 'both') {
      if (pricing_model === 'single' || pricing_model === 'both') {
        if (!rest.single_price || rest.single_price <= 0) {
          throw new AppError('单张模式须填写有效的 single_price', 400, 'INVALID_SINGLE_PRICE');
        }
        if (!rest.single_duration_minutes || rest.single_duration_minutes <= 0) {
          throw new AppError('单张模式须填写拍摄耗时', 400, 'INVALID_SINGLE_DURATION');
        }
      }
      if (pricing_model === 'package' || pricing_model === 'both') {
        if (!rest.package_price || rest.package_price <= 0) {
          throw new AppError('套餐模式须填写有效的 package_price', 400, 'INVALID_PACKAGE_PRICE');
        }
        if (!rest.package_session_count || rest.package_session_count <= 0) {
          throw new AppError('套餐模式须填写 package_session_count', 400, 'INVALID_PACKAGE_COUNT');
        }
        if (!rest.package_session_duration_minutes || rest.package_session_duration_minutes <= 0) {
          throw new AppError('套餐模式须填写单次拍摄耗时', 400, 'INVALID_PACKAGE_DURATION');
        }
      }
    }

    // ---- 写入项目 ----
    const studio = await Studio.create({ ...rest, is_style_enabled, pricing_model });

    // ---- 写入样式关联 ----
    if (is_style_enabled && style_ids && style_ids.length > 0) {
      await StudioStyleRelation.batchReplace(studio.id, style_ids);
    }

    return this.detail(studio.id);
  },

  async update(id, data) {
    await this.detail(id);
    const { style_ids, ...studioData } = data;
    const studio = await Studio.update(id, studioData);
    if (style_ids !== undefined) {
      await StudioStyleRelation.batchReplace(id, style_ids);
    }
    return this.detail(id);
  },

  async remove(id) {
    await this.detail(id);
    return Studio.delete(id);
  },
};

module.exports = StudioService;
