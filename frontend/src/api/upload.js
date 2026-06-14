/** 文件上传 API */
import http from '@/utils/http'

export function uploadImage(file) {
  const fd = new FormData()
  fd.append('file', file)
  return http.post('/upload/image', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function uploadImages(files) {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  return http.post('/upload/images', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
