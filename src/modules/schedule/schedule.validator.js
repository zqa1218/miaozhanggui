const Joi = require('joi');

const bookedTimesQuerySchema = Joi.object({
  mId: Joi.string().required(),
  date: Joi.string().required(),
  studioId: Joi.number().required(),
  studioTitle: Joi.string().optional(),
  serviceMode: Joi.string().optional(),
});

const unavailableSlotsSaveSchema = Joi.object({
  mId: Joi.string().required(),
  studioId: Joi.number().required(),
  date: Joi.string().required(),
  slots: Joi.array().items(Joi.string()).required(),
  slotsEnd: Joi.array().items(Joi.string()).optional(),
});

const excelImportQuerySchema = Joi.object({
  batch_id: Joi.string().max(64).optional(),
  status: Joi.string().valid('pending', 'processed', 'failed').optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(200).default(20),
});

const excelExportQuerySchema = Joi.object({
  batch_id: Joi.string().max(64).optional(),
  status: Joi.string().valid('pending', 'processed', 'failed').optional(),
});

module.exports = {
  bookedTimesQuerySchema, unavailableSlotsSaveSchema,
  excelImportQuerySchema, excelExportQuerySchema,
};
