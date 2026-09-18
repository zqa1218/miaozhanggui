const XLSX = require('xlsx');
// 固定档位模板需要写单元格填充色（标黄），SheetJS CE 会静默丢弃样式，
// 所以模板生成单独用 API 兼容的 xlsx-js-style；读/写既有表格仍走 XLSX，
// 把新增依赖的风险限制在模板这一条路径内。
const XLSXS = require('xlsx-js-style');
const path = require('path');
const fs = require('fs');
const AppError = require('../errors/AppError');
const errorCodes = require('../errors/errorCodes');
const { timeToMinutes, minutesToTime } = require('./dateHelper');

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
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: h.width }));
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
    const excelRowNum = idx + 2;
    const rowErrors = [];

    const project = String(row[TEMPLATE_HEADERS[0].label] || '').trim();
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
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = ORDER_IMPORT_HEADERS.map(h => ({ wch: h.width }));
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
    const projectName = String(row['预约项目'] || '').trim();
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

// ════════════════════════════════════════
//  固定档位导入模板 (studios.time_mode = 'fixed_slot')
// ════════════════════════════════════════
//
//  与上面的 ORDER_IMPORT_HEADERS 是两套东西：那套是「项目/样式/套餐/日期」全字段的
//  通用导入模板，这套只服务于固定档位 —— 项目与日期在下载时就定死了，
//  所以模板里只需要「档位时间」+ 客户信息 + 金额。
//  模板只列当天**还空着**的档位，解析端因此不必判断"某行是不是已废弃的档位"。

const SLOT_IMPORT_HEADERS = [
  { key: 'slot',       label: '档位时间',   width: 16, required: true  },
  { key: 'roleName',   label: '角色名称',   width: 20, required: true  },
  { key: 'customerCn', label: '顾客cn',     width: 18, required: true  },
  { key: 'note',       label: '备注要求',   width: 32, required: false },
  { key: 'totalPrice', label: '订单总金额', width: 14, required: true  },
  { key: 'deposit',    label: '定金',       width: 12, required: true  },
];

const SLOT_SHEET_PREFIX = '档位模板 ';
const SLOT_TAKEN_SHEET = '当日已占用';

const ST_HEADER = {
  font: { bold: true, color: { rgb: '4A4642' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'F4F2EE' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};
// ★ 第一列标黄 —— 摄影师一眼能看出哪些格子是要填的
const ST_SLOT = {
  font: { bold: true, color: { rgb: '8A6420' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } },
  alignment: { horizontal: 'center' },
};
const ST_TAKEN = {
  font: { color: { rgb: '9A938C' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'F4F2EE' } },
  alignment: { horizontal: 'center' },
};

/**
 * 生成固定档位导入模板
 * @param {Object} p
 * @param {string} p.date          'YYYY-MM-DD'，写进 sheet 名供导入时交叉校验
 * @param {number} p.slotDuration  每档分钟数
 * @param {string} p.studioTitle   项目名，仅写进 Sheet2 供人核对
 * @param {Array}  p.slots         generateFixedSlots() 的全量输出（含不可用）
 * @returns {Buffer}
 */
function generateSlotTemplateBuffer({ date, slotDuration, studioTitle = '', slots = [] }) {
  const wb = XLSXS.utils.book_new();

  // ── Sheet1：导入用，只列还空着的档位 ──
  const header = SLOT_IMPORT_HEADERS.map((h) => h.label);
  const available = (slots || []).filter((s) => s.available);
  const rows = available.map((s) => [`${s.start}-${s.end}`, '', '', '', '', '']);
  const ws = XLSXS.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = SLOT_IMPORT_HEADERS.map((h) => ({ wch: h.width }));

  SLOT_IMPORT_HEADERS.forEach((h, c) => {
    const addr = XLSXS.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = ST_HEADER;
  });
  available.forEach((s, i) => {
    const addr = XLSXS.utils.encode_cell({ r: i + 1, c: 0 });
    if (ws[addr]) ws[addr].s = ST_SLOT;
  });

  // sheet 名带日期，导入时用它交叉校验，防止"下载 09-20 的模板却导到 09-21"
  XLSXS.utils.book_append_sheet(wb, ws, (SLOT_SHEET_PREFIX + date).slice(0, 31));

  // ── Sheet2：只读参考，列出当天被占/休息的档位 ──
  const taken = (slots || []).filter((s) => !s.available);
  const takenRows = [
    ['档位时间', '状态', '订单号'],
    ...taken.map((s) => [
      `${s.start}-${s.end}`,
      s.blockedBy === 'rest' ? '休息' : '已被预约',
      s.orderNo || '',
    ]),
  ];
  const ws2 = XLSXS.utils.aoa_to_sheet(takenRows);
  ws2['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 26 }];
  ['A1', 'B1', 'C1'].forEach((a) => { if (ws2[a]) ws2[a].s = ST_HEADER; });
  taken.forEach((_, i) => {
    const addr = XLSXS.utils.encode_cell({ r: i + 1, c: 0 });
    if (ws2[addr]) ws2[addr].s = ST_TAKEN;
  });
  XLSXS.utils.book_append_sheet(wb, ws2, SLOT_TAKEN_SHEET);

  return XLSXS.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/** 任意单元格 → 'HH:mm' | null（同时吃字符串与 Excel 原生时间序列号） */
function parseExcelTime(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) {
    return `${String(raw.getHours()).padStart(2, '0')}:${String(raw.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof raw === 'number') {
    // Excel 时间序列号：0.5 = 12:00。带整数部分表示含日期，只取小数部分。
    let mins = Math.round((raw - Math.floor(raw)) * 24 * 60);
    if (mins >= 1440) mins -= 1440;   // 23:59:59.x 的舍入保护
    if (mins < 0) return null;
    return minutesToTime(mins);
  }
  const s = String(raw).trim().replace(/：/g, ':');
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/** 档位单元格 → { start, end }。支持 "HH:mm-HH:mm"、单值 "HH:mm"、原生时间序列号 */
function parseSlotCell(raw, slotDuration) {
  if (raw === null || raw === undefined || raw === '') return { start: null, end: null };
  if (typeof raw === 'string') {
    const parts = raw
      .replace(/：/g, ':')
      .replace(/[—–~～至]/g, '-')
      .split('-')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) return { start: parseExcelTime(parts[0]), end: parseExcelTime(parts[1]) };
  }
  const start = parseExcelTime(raw);
  if (!start) return { start: null, end: null };
  const dur = parseInt(slotDuration, 10) || 30;
  return { start, end: minutesToTime(timeToMinutes(start) + dur) };
}

/** 金额单元格 → number | null（容忍 ¥ ￥ , 空格 元） */
function parseMoneyCell(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).replace(/[¥￥,\s]/g, '').replace(/元$/, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * 解析固定档位导入文件。**按列位置取值**，不按中文表头匹配 ——
 * 商家改了表头文字也不影响导入（旧版 parseOrderImportExcel 只认精确中文列名）。
 *
 * @returns {{ validRows, errors, total, sheetDate }}
 */
function parseSlotImportExcel(filePath, { baseStart, baseEnd, slotDuration, isSlotAligned } = {}) {
  if (!fs.existsSync(filePath)) {
    throw new AppError(errorCodes.INTERNAL_ERROR, 400, '上传文件不存在');
  }
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.find((n) => n.startsWith(SLOT_SHEET_PREFIX)) || wb.SheetNames[0];
  if (!sheetName) throw new AppError(errorCodes.PARAM_INVALID, 400, 'Excel 文件中未找到工作表');
  const ws = wb.Sheets[sheetName];

  const dm = String(sheetName).match(/(\d{4}-\d{2}-\d{2})/);
  const sheetDate = dm ? dm[1] : null;

  // raw:true 才能拿到 Excel 原生日期/时间的数字序列号
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true, header: 1 });
  const dur = parseInt(slotDuration, 10) || 30;
  const errors = [];
  const validRows = [];

  // header:1 → 第一行是表头，从第二行开始是数据
  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    // 模板会把第一列（档位时间）预填好，所以"用户没填内容"的行并不是空行。
    // 判断依据只能是第 2 列及之后：全部为空 = 这一档不排单，整行跳过，
    // 而不是报一堆"角色名称不能为空"。只填了其中任意一列才参与校验。
    const filled = row.slice(1).some((c) => c !== '' && c !== null && c !== undefined);
    if (!filled) continue;

    const rowNum = r + 1;
    const errs = [];

    const { start, end } = parseSlotCell(row[0], dur);
    if (!start || !end) {
      errs.push('档位时间格式错误（应为 HH:mm-HH:mm）');
    } else {
      if (timeToMinutes(end) - timeToMinutes(start) !== dur) {
        errs.push(`档位时长必须为 ${dur} 分钟`);
      } else if (typeof isSlotAligned === 'function' && !isSlotAligned(start, baseStart, dur)) {
        errs.push(`档位 ${start} 不在可选档位网格上（${baseStart} 起每 ${dur} 分钟一档）`);
      } else if (timeToMinutes(start) < timeToMinutes(baseStart) || timeToMinutes(end) > timeToMinutes(baseEnd)) {
        errs.push(`档位 ${start}-${end} 超出营业时间 ${baseStart}-${baseEnd}`);
      }
    }

    const roleName = String(row[1] ?? '').trim();
    const customerCn = String(row[2] ?? '').trim();
    const note = String(row[3] ?? '').trim();
    const totalPrice = parseMoneyCell(row[4]);
    const deposit = parseMoneyCell(row[5]);

    if (!roleName) errs.push('角色名称不能为空');
    if (!customerCn) errs.push('顾客cn 不能为空');
    if (totalPrice === null || totalPrice < 0) errs.push('订单总金额格式错误');
    if (deposit === null || deposit < 0) errs.push('定金格式错误');
    if (totalPrice !== null && deposit !== null && deposit > totalPrice) {
      errs.push('定金不能大于订单总金额');
    }

    if (errs.length) errors.push({ row: rowNum, errors: errs });
    else validRows.push({ rowNum, start, end, roleName, customerCn, note, totalPrice, deposit });
  }

  return { validRows, errors, total: Math.max(0, rawRows.length - 1), sheetDate, sheetName };
}

module.exports = {
  TEMPLATE_HEADERS, generateTemplateBuffer, parseUploadedExcel, exportToExcelBuffer,
  ORDER_IMPORT_HEADERS, generateOrderTemplateBuffer, exportOrdersToExcel, parseOrderImportExcel,
  SLOT_IMPORT_HEADERS, SLOT_SHEET_PREFIX, generateSlotTemplateBuffer, parseSlotImportExcel,
};
