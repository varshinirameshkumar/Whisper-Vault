import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: false,
})

// Attach JWT on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('wv_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wv_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api