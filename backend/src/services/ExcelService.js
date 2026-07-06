const ExcelJS = require('exceljs');
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const ExcelService = {
  async generateTemplate() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('排期模板');
    ws.columns = [
      { header: '项目名称', key: 'project', width: 20 },
      { header: '日期(YYYY-MM-DD)', key: 'date', width: 16 },
      { header: '开始时间(HH:mm)', key: 'start', width: 14 },
      { header: '结束时间(HH:mm)', key: 'end', width: 14 },
      { header: '联系方式', key: 'contact', width: 20 },
      { header: '备注', key: 'remarks', width: 30 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.addRow({ project: '示例项目', date: '2026-07-01', start: '09:00', end: '10:00', contact: '13800138000', remarks: '张三' });
    return wb.xlsx.writeBuffer();
  },

  async processImport(filePath, mId) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.worksheets[0];
    const batchId = uuidv4();
    const rows = [];
    const errors = [];

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const project = String(row.getCell(1).value || '').trim();
      const date = String(row.getCell(2).value || '').trim();
      const start = String(row.getCell(3).value || '').trim();
      const end = String(row.getCell(4).value || '').trim();
      const contact = String(row.getCell(5).value || '').trim();
      const remarks = String(row.getCell(6).value || '').trim();
      if (!project || !date || !start || !end || !contact) return;
      rows.push([batchId, project, date, start, end, contact, remarks, mId]);
    });

    if (rows.length === 0) {
      return { message: '未找到有效数据行', batchId };
    }

    // 批量插入，跳过错误行
    let inserted = 0;
    for (const r of rows) {
      try {
        await pool.query(
          `INSERT INTO schedule_excel_imports (batch_id, project, schedule_date, time_slot_start, time_slot_end, contact, remarks, status, m_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
          r
        );
        inserted++;
      } catch (e) {
        errors.push({ row: inserted + 1, errors: [e.message] });
      }
    }

    return { message: `成功导入 ${inserted} 条，失败 ${errors.length} 条`, batchId, errors };
  },

  async exportData(mId) {
    const [rows] = await pool.query(
      'SELECT * FROM schedule_excel_imports WHERE m_id = ? ORDER BY schedule_date DESC, time_slot_start ASC LIMIT 10000',
      [mId]
    );
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('排期数据');
    ws.columns = [
      { header: '项目', key: 'project', width: 20 },
      { header: '日期', key: 'schedule_date', width: 14 },
      { header: '开始', key: 'time_slot_start', width: 10 },
      { header: '结束', key: 'time_slot_end', width: 10 },
      { header: '联系方式', key: 'contact', width: 20 },
      { header: '备注', key: 'remarks', width: 30 },
      { header: '状态', key: 'status', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach(r => ws.addRow(r));
    return wb.xlsx.writeBuffer();
  },
};
module.exports = ExcelService;
