import http from '@/utils/http'

export const styleApi = {
  list(params) {
    return http.get('/styles', params)
  },

  detail(id) {
    return http.get(`/styles/${id}`)
  },

  create(data) {
    return http.post('/styles', data)
  },

  update(id, data) {
    return http.put(`/styles/${id}`, data)
  },

  remove(id) {
    return http.delete(`/styles/${id}`)
  },
}
