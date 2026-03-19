import axios from 'axios'

// In production: VITE_API_URL is set in Vercel environment variables
// In development: falls back to localhost:8080
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
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
