const ExcelService = require('../services/ExcelService');

const ExcelController = {
  async template(req, res, next) {
    try {
      const buffer = await ExcelService.generateTemplate();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=schedule_template.xlsx');
      res.send(buffer);
    } catch (err) { next(err); }
  },

  async importFile(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: '请上传文件' });
      const result = await ExcelService.processImport(req.file.path, req.merchant.mId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async batches(req, res, next) {
    try {
      const { pool } = require('../config/database');
      const [rows] = await pool.query(
        `SELECT batch_id, project, schedule_date, status, COUNT(*) AS total,
                SUM(status='failed') AS failed_count, created_at
         FROM schedule_excel_imports WHERE m_id = ? GROUP BY batch_id, project, schedule_date, status, created_at
         ORDER BY created_at DESC LIMIT 50`,
        [req.merchant.mId]
      );
      const [totalRes] = await pool.query('SELECT COUNT(DISTINCT batch_id) AS total FROM schedule_excel_imports WHERE m_id = ?', [req.merchant.mId]);
      res.json({ success: true, data: { rows, total: totalRes[0].total } });
    } catch (err) { next(err); }
  },

  async batchDetail(req, res, next) {
    try {
      const { pool } = require('../config/database');
      const [rows] = await pool.query(
        'SELECT * FROM schedule_excel_imports WHERE batch_id = ? AND m_id = ?',
        [req.params.batchId, req.merchant.mId]
      );
      res.json({ success: true, data: { rows } });
    } catch (err) { next(err); }
  },

  async exportData(req, res, next) {
    try {
      const buffer = await ExcelService.exportData(req.merchant.mId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=schedule_export.xlsx');
      res.send(buffer);
    } catch (err) { next(err); }
  },
};
module.exports = ExcelController;
