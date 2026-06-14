const router = require('express').Router();
const multer = require('multer');
const os = require('os');
const path = require('path');
const ctrl = require('./schedule.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validator');
const {
  bookedTimesQuerySchema,
  unavailableSlotsSaveSchema,
  excelImportQuerySchema,
  excelExportQuerySchema,
} = require('./schedule.validator');

// multer 文件上传（Excel）
const excelUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('仅支持 .xlsx 或 .xls 格式'), false);
  },
});

router.get('/booked-times', ctrl.getBookedTimes);
router.get('/unavailable-slots/grid', auth, ctrl.getUnavailableGrid);
router.post('/unavailable-slots/save', auth, validate(unavailableSlotsSaveSchema), ctrl.saveUnavailableSlots);

// Excel 导入导出
router.get('/excel/template', auth, ctrl.downloadTemplate);
router.post('/excel/import', auth, excelUpload.single('file'), ctrl.importExcel);
router.get('/excel/batches', auth, validate(excelImportQuerySchema, 'query'), ctrl.listBatches);
router.get('/excel/batches/:batchId', auth, ctrl.getBatchDetail);
router.get('/excel/export', auth, validate(excelExportQuerySchema, 'query'), ctrl.exportData);

module.exports = router;
