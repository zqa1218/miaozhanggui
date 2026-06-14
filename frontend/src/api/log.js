/** 日志 & Excel API */
import http from '@/utils/http'

export function getLogs(params) {
  return http.get('/logs', { params })
}

export function addLog(data) {
  return http.post('/logs', data)
}

export function clearLogs() {
  return http.post('/clear-logs')
}

export function downloadExcelTemplate() {
  return http.get('/excel/template', { responseType: 'blob' })
}

export function importExcel(file) {
  const fd = new FormData()
  fd.append('file', file)
  return http.post('/excel/import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function getExcelBatches(params) {
  return http.get('/excel/batches', { params })
}

export function getExcelBatchDetail(batchId) {
  return http.get(`/excel/batches/${batchId}`)
}

export function exportExcel(params) {
  return http.get('/excel/export', { params, responseType: 'blob' })
}
