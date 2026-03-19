import api from './axiosConfig'

export const authService = {
  async register(data) {
    const res = await api.post('/auth/register', data)
    const { token, user } = res.data.data
    localStorage.setItem('wv_token', token)
    return user
  },
  async login(username, password) {
    const res = await api.post('/auth/login', { username, password })
    const { token, user } = res.data.data
    localStorage.setItem('wv_token', token)
    return user
  },
  async getMe() {
    const res = await api.get('/auth/me')
    return res.data.data
  },
  async updateProfile(data) {
    const res = await api.put('/auth/me/profile', data)
    return res.data.data
  },
  async changePassword(currentPassword, newPassword) {
    const res = await api.put('/auth/me/password', { currentPassword, newPassword })
    return res.data
  },
  async toggleNotifications(enabled) {
    const res = await api.put(`/auth/me/notifications?enabled=${enabled}`)
    return res.data.data
  },
  logout() { localStorage.removeItem('wv_token') },
}
