const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const AppError = require('../errors/AppError');
const errorCodes = require('../errors/errorCodes');

const TEMPLATE_HEADERS = [
  { key: 'project',          label: '项目',          width: 20, required: true  },
  { key: 'schedule_date',    label: '时间（年/月/日）', width: 18, required: true  },
  { key: 'time_slot_start',  label: '时间段-开始',    width: 14, required: true  },
  { key: 'time_slot_end',    label: '时间段-结束',    width: 14, required: true  },
  { key: 'contact',          label: '联系方式',       width: 20, required: true  },
  { key: 'remarks',          label: '备注',           width: 30, required: false },
];

const DATE_REGEX = /^(\d{4})[\/\-.\s](\d{1,2})[\/\-.\s](\d{1,2})$/;
const TIME_REGEX = /^(\d{1,2}):(\d{2})$/;

function generateTemplateBuffer() {
  const wb = XLSX.utils.book_new();
  const headers = TEMPLATE_HEADERS.map((h) => h.label);
  // 第3行为示例数据行（第2行留空给用户填写），用浅蓝色背景标示
  const exampleRow = ['示例项目名称', '2026-06-01', '09:00', '12:00', '13800138000', '这是一个填写格式示例，导入时会被自动忽略'];
  const ws = XLSX.utils.aoa_to_sheet([headers, [], exampleRow]);
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: h.width }));
  // 示例行标记浅蓝色背景（第3行，0-indexed 为 row 2）
  const exampleRowNum = 2;
  for (let c = 0; c < TEMPLATE_HEADERS.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: exampleRowNum, c });
    if (ws[cellRef]) {
      ws[cellRef].s = { fill: { fgColor: { rgb: 'E8F0FE' } }, font: { color: { rgb: '5A7A9A' } } };
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, '排期导入模板');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function parseUploadedExcel(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new AppError(errorCodes.INTERNAL_ERROR, 400, '上传文件不存在');
  }
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new AppError(errorCodes.PARAM_INVALID, 400, 'Excel 文件中未找到工作表');
  }
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (rawRows.length === 0) {
    throw new AppError(errorCodes.PARAM_INVALID, 400, 'Excel 文件中无数据行');
  }

  const errors = [];
  const validRows = [];

  rawRows.forEach((row, idx) => {
    const excelRowNum = idx + 2; // Excel row number (1 = header, 2 = first data row)
    const rowErrors = [];

    const project = String(row[TEMPLATE_HEADERS[0].label] || '').trim();

    // 跳过示例行：任何项目名为"示例项目名称"的行
    if (project === '示例项目名称') {
      return; // skip this row
    }
    // 跳过第二行空行（用户填写前留空），以及任何完全空白的行
    if (!project && !row[TEMPLATE_HEADERS[1].label] && !row[TEMPLATE_HEADERS[4].label]) {
      return;
    }

    if (!project) rowErrors.push('项目不能为空');

    const dateRaw = String(row[TEMPLATE_HEADERS[1].label] || '').trim();
    let scheduleDate = null;
    if (dateRaw) {
      if (/^\d{5}$/.test(dateRaw) && Number(dateRaw) > 40000) {
        const parsed = XLSX.SSF.parse_date_code(Number(dateRaw));
        scheduleDate = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      } else {
        const m = dateRaw.match(DATE_REGEX);
        if (m) scheduleDate = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
      }
    }
    if (!scheduleDate) rowErrors.push('时间格式错误');
    if (scheduleDate && isNaN(Date.parse(scheduleDate))) rowErrors.push(`日期不合法: ${scheduleDate}`);

    const startRaw = row[TEMPLATE_HEADERS[2].label];
    let timeSlotStart = null;
    if (typeof startRaw === 'number' && startRaw < 1) {
      const totalMinutes = Math.round(startRaw * 24 * 60);
      timeSlotStart = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
    } else if (startRaw) {
      const sm = String(startRaw).trim().match(TIME_REGEX);
      if (sm) timeSlotStart = `${String(sm[1]).padStart(2, '0')}:${sm[2]}`;
    }
    if (!timeSlotStart) rowErrors.push('时间段-开始格式错误');

    const endRaw = row[TEMPLATE_HEADERS[3].label];
    let timeSlotEnd = null;
    if (typeof endRaw === 'number' && endRaw < 1) {
      const totalMinutes = Math.round(endRaw * 24 * 60);
      timeSlotEnd = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
    } else if (endRaw) {
      const em = String(endRaw).trim().match(TIME_REGEX);
      if (em) timeSlotEnd = `${String(em[1]).padStart(2, '0')}:${em[2]}`;
    }
    if (!timeSlotEnd) rowErrors.push('时间段-结束格式错误');

    if (timeSlotStart && timeSlotEnd && timeSlotStart >= timeSlotEnd) {
      rowErrors.push('时间段开始必须早于结束');
    }

    const contact = String(row[TEMPLATE_HEADERS[4].label] || '').trim();
    if (!contact) rowErrors.push('联系方式不能为空');

    const remarks = String(row[TEMPLATE_HEADERS[5].label] || '').trim();

    if (rowErrors.length > 0) {
      errors.push({ row: excelRowNum, errors: rowErrors });
    } else {
      validRows.push({ project, schedule_date: scheduleDate, time_slot_start: timeSlotStart, time_slot_end: timeSlotEnd, contact, remarks: remarks || null });
    }
  });

  return { validRows, errors, total: rawRows.length, successCount: validRows.length, failCount: errors.length };
}

function exportToExcelBuffer(rows) {
  const wb = XLSX.utils.book_new();
  const headers = TEMPLATE_HEADERS.map((h) => h.label);
  const data = rows.map((r) => [r.project || '', r.schedule_date || '', r.time_slot_start || '', r.time_slot_end || '', r.contact || '', r.remarks || '']);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: h.width }));
  XLSX.utils.book_append_sheet(wb, ws, '排期数据');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ════════════════════════════════════════
//  订单导入模板
// ════════════════════════════════════════

const ORDER_IMPORT_HEADERS = [
  { key: 'orderId',        label: '订单编号',     width: 20, required: false },
  { key: 'customerName',   label: '客户姓名',     width: 14, required: true  },
  { key: 'customerPhone',  label: '手机号',       width: 16, required: true  },
  { key: 'projectName',    label: '预约项目',     width: 18, required: true  },
  { key: 'styleName',      label: '选择样式',     width: 14, required: false },
  { key: 'packageName',    label: '选择套餐',     width: 14, required: false },
  { key: 'date',           label: '预约日期',     width: 14, required: true  },
  { key: 'startTime',      label: '起始时间',     width: 12, required: true  },
  { key: 'paymentStatus',  label: '支付状态',     width: 12, required: false },
];

function generateOrderTemplateBuffer() {
  const wb = XLSX.utils.book_new();
  const headers = ORDER_IMPORT_HEADERS.map(h => h.label);
  // 第3行为示例数据行（第2行留空给用户填写），用浅蓝色背景标示
  const exampleRow = ['', '张三', '13800138000', '示例项目名称', '默认风格', '基础套餐', '2026-06-01', '09:00', '待付定金'];
  const ws = XLSX.utils.aoa_to_sheet([headers, [], exampleRow]);
  ws['!cols'] = ORDER_IMPORT_HEADERS.map(h => ({ wch: h.width }));
  // 示例行标记浅蓝色背景（第3行，0-indexed 为 row 2）
  const exampleRowNum = 2;
  for (let c = 0; c < ORDER_IMPORT_HEADERS.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: exampleRowNum, c });
    if (ws[cellRef]) {
      ws[cellRef].s = { fill: { fgColor: { rgb: 'E8F0FE' } }, font: { color: { rgb: '5A7A9A' } } };
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, '订单导入');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function exportOrdersToExcel(orders) {
  const wb = XLSX.utils.book_new();
  const headers = ORDER_IMPORT_HEADERS.map(h => h.label);
  const rows = orders.map(o => [
    o.orderNo || '',
    o.roleName || o.customerName || '',
    o.contactNote || o.contact || o.customerPhone || '',
    o.studioTitle || o.projectName || '',
    o.styleName || '',
    o.packageName || '',
    o.date || '',
    o.bookingStartTime || o.startTime || '',
    o.paymentStatus || o.status || '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = ORDER_IMPORT_HEADERS.map(h => ({ wch: h.width }));
  XLSX.utils.book_append_sheet(wb, ws, '订单数据');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function parseOrderImportExcel(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new AppError(errorCodes.INTERNAL_ERROR, 400, '上传文件不存在');
  }
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new AppError(errorCodes.PARAM_INVALID, 400, 'Excel 文件中未找到工作表');
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (rawRows.length === 0) throw new AppError(errorCodes.PARAM_INVALID, 400, 'Excel 文件中无数据行');

  const errors = [];
  const validRows = [];

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // Excel row number (1 = header)
    const rowErrors = [];

    const customerName = String(row['客户姓名'] || '').trim();
    const customerPhone = String(row['手机号'] || '').trim();

    // 跳过示例行：任何项目名为"示例项目名称"的行，以及完全空白的行
    const projectName = String(row['预约项目'] || '').trim();
    if (projectName === '示例项目名称' || (!customerName && !projectName && !customerPhone)) {
      return; // skip this row
    }
    const styleName = String(row['选择样式'] || '').trim();
    const packageName = String(row['选择套餐'] || '').trim();
    const dateRaw = String(row['预约日期'] || '').trim();
    const startTimeRaw = String(row['起始时间'] || '').trim();
    const paymentStatus = String(row['支付状态'] || '待付定金').trim();

    if (!customerName) rowErrors.push('客户姓名不能为空');
    if (!customerPhone) rowErrors.push('手机号不能为空');
    if (!projectName) rowErrors.push('预约项目不能为空');

    // 日期解析
    let date = null;
    if (dateRaw) {
      const m = dateRaw.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
      if (m) date = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    }
    if (!date) rowErrors.push('预约日期格式错误，需为 YYYY-MM-DD');

    // 时间解析
    let startTime = null;
    if (startTimeRaw) {
      const m = startTimeRaw.match(/^(\d{1,2}):(\d{2})$/);
      if (m) startTime = `${String(m[1]).padStart(2, '0')}:${m[2]}`;
    }
    if (!startTime) rowErrors.push('起始时间格式错误，需为 HH:mm');

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, errors: rowErrors });
    } else {
      validRows.push({
        rowNum,
        customerName, customerPhone, projectName,
        styleName, packageName, date, startTime,
        paymentStatus: paymentStatus || '待付定金',
      });
    }
  });

  return { validRows, errors, total: rawRows.length };
}

module.exports = {
  TEMPLATE_HEADERS, generateTemplateBuffer, parseUploadedExcel, exportToExcelBuffer,
  ORDER_IMPORT_HEADERS, generateOrderTemplateBuffer, exportOrdersToExcel, parseOrderImportExcel,
};
