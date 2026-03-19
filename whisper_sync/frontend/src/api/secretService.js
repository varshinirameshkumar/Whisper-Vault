import api from './axiosConfig'

export const secretService = {
  async sendSecret(data) {
    const res = await api.post('/secrets', data)
    return res.data.data
  },
  async getInbox() {
    const res = await api.get('/secrets/inbox')
    return res.data.data
  },
  async getSent() {
    const res = await api.get('/secrets/sent')
    return res.data.data
  },
  async burnSecret(id) {
    const res = await api.post(`/secrets/${id}/burn`)
    return res.data.data
  },
  async getStats() {
    const res = await api.get('/secrets/stats')
    return res.data.data
  },
  async searchUsers(q) {
    const res = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
    return res.data.data
  }
}