const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { AppError } = require('../errors/AppError');
const errorCodes = require('../errors/errorCodes');

// ============================================================
//  模板表头定义（与前端下载、后端解析强一致）
// ============================================================
const TEMPLATE_HEADERS = [
  { key: 'project',          label: '项目',          width: 20, required: true  },
  { key: 'schedule_date',    label: '时间（年/月/日）', width: 18, required: true  },
  { key: 'time_slot_start',  label: '时间段-开始',    width: 14, required: true  },
  { key: 'time_slot_end',    label: '时间段-结束',    width: 14, required: true  },
  { key: 'contact',          label: '联系方式',       width: 20, required: true  },
  { key: 'remarks',          label: '备注',           width: 30, required: false },
];

// 日期正则：支持 2026/6/2、2026-06-02、2026.06.02 等
const DATE_REGEX = /^(\d{4})[\/\-. ](\d{1,2})[\/\-. ](\d{1,2})$/;
// 时间段正则：HH:mm 或 H:mm
const TIME_REGEX = /^(\d{1,2}):(\d{2})$/;

// ============================================================
//  1. 生成并返回 Excel 模板文件的 Buffer
// ============================================================
function generateTemplateBuffer() {
  // 创建工作簿
  const wb = XLSX.utils.book_new();

  // 只写表头行（无数据行）
  const headers = TEMPLATE_HEADERS.map((h) => h.label);
  const ws = XLSX.utils.aoa_to_sheet([headers]);

  // 设置列宽
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: h.width }));

  XLSX.utils.book_append_sheet(wb, ws, '排期导入模板');

  // 输出为 Buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

// ============================================================
//  2. 解析上传的 Excel 文件，返回标准化行数据
// ============================================================
function parseUploadedExcel(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new AppError(errorCodes.FILE_NOT_FOUND, '上传文件不存在');
  }

  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new AppError(errorCodes.INVALID_PARAM, 'Excel 文件中未找到工作表');
  }

  const ws = wb.Sheets[sheetName];
  // sheet_to_json 将第一行自动作为表头
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  if (rawRows.length === 0) {
    throw new AppError(errorCodes.INVALID_PARAM, 'Excel 文件中无数据行，请填写数据后上传');
  }

  const errors = [];
  const validRows = [];

  rawRows.forEach((row, idx) => {
    const excelRowNum = idx + 2; // 第1行是表头，数据从第2行开始
    const rowErrors = [];

    // --- 解析"项目" ---
    const project = String(row[TEMPLATE_HEADERS[0].label] || '').trim();
    if (!project) rowErrors.push('项目不能为空');

    // --- 解析"时间（年/月/日）" ---
    const dateRaw = String(row[TEMPLATE_HEADERS[1].label] || '').trim();
    let scheduleDate = null;
    if (dateRaw) {
      // 有可能是 Excel 日期数字
      if (/^\d{5}$/.test(dateRaw) && Number(dateRaw) > 40000) {
        // Excel 序列号日期
        const parsed = XLSX.SSF.parse_date_code(Number(dateRaw));
        scheduleDate = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      } else {
        const m = dateRaw.match(DATE_REGEX);
        if (m) {
          scheduleDate = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
        }
      }
    }
    if (!scheduleDate) rowErrors.push('时间格式错误，请使用 yyyy/mm/dd 或 yyyy-mm-dd');
    // 验证日期合法性
    if (scheduleDate && isNaN(Date.parse(scheduleDate))) {
      rowErrors.push(`日期不合法: ${scheduleDate}`);
    }

    // --- 解析"时间段-开始" ---
    const startRaw = String(row[TEMPLATE_HEADERS[2].label] || '').trim();
    let timeSlotStart = null;
    if (startRaw) {
      // Excel 时间可能是小数（如 0.375 = 09:00）或字符串
      if (typeof row[TEMPLATE_HEADERS[2].label] === 'number' && row[TEMPLATE_HEADERS[2].label] < 1) {
        const totalMinutes = Math.round(row[TEMPLATE_HEADERS[2].label] * 24 * 60);
        const hh = Math.floor(totalMinutes / 60);
        const mm = totalMinutes % 60;
        timeSlotStart = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      } else {
        const sm = startRaw.match(TIME_REGEX);
        if (sm) {
          const hh = parseInt(sm[1], 10);
          const mm = parseInt(sm[2], 10);
          if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
            timeSlotStart = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
          }
        }
      }
    }
    if (!timeSlotStart) rowErrors.push('时间段-开始格式错误，请使用 HH:mm');

    // --- 解析"时间段-结束" ---
    const endRaw = String(row[TEMPLATE_HEADERS[3].label] || '').trim();
    let timeSlotEnd = null;
    if (endRaw) {
      if (typeof row[TEMPLATE_HEADERS[3].label] === 'number' && row[TEMPLATE_HEADERS[3].label] < 1) {
        const totalMinutes = Math.round(row[TEMPLATE_HEADERS[3].label] * 24 * 60);
        const hh = Math.floor(totalMinutes / 60);
        const mm = totalMinutes % 60;
        timeSlotEnd = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      } else {
        const em = endRaw.match(TIME_REGEX);
        if (em) {
          const hh = parseInt(em[1], 10);
          const mm = parseInt(em[2], 10);
          if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
            timeSlotEnd = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
          }
        }
      }
    }
    if (!timeSlotEnd) rowErrors.push('时间段-结束格式错误，请使用 HH:mm');

    // --- 时间段逻辑校验 ---
    if (timeSlotStart && timeSlotEnd && timeSlotStart >= timeSlotEnd) {
      rowErrors.push('时间段开始必须早于结束');
    }

    // --- 解析"联系方式" ---
    const contact = String(row[TEMPLATE_HEADERS[4].label] || '').trim();
    if (!contact) rowErrors.push('联系方式不能为空');

    // --- 解析"备注"（可选）---
    const remarks = String(row[TEMPLATE_HEADERS[5].label] || '').trim();

    if (rowErrors.length > 0) {
      errors.push({ row: excelRowNum, errors: rowErrors });
    } else {
      validRows.push({
        project,
        schedule_date: scheduleDate,
        time_slot_start: timeSlotStart,
        time_slot_end: timeSlotEnd,
        contact,
        remarks: remarks || null,
      });
    }
  });

  return {
    validRows,
    errors,
    total: rawRows.length,
    successCount: validRows.length,
    failCount: errors.length,
  };
}

// ============================================================
//  3. 导出数据为 Excel Buffer（用于已导入数据导出）
// ============================================================
function exportToExcelBuffer(rows) {
  const wb = XLSX.utils.book_new();
  const headers = TEMPLATE_HEADERS.map((h) => h.label);

  const data = rows.map((r) => [
    r.project || '',
    r.schedule_date || '',
    r.time_slot_start || '',
    r.time_slot_end || '',
    r.contact || '',
    r.remarks || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: h.width }));

  XLSX.utils.book_append_sheet(wb, ws, '排期数据');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  TEMPLATE_HEADERS,
  generateTemplateBuffer,
  parseUploadedExcel,
  exportToExcelBuffer,
};
