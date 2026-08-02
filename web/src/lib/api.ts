import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5022'

export const api = axios.create({ baseURL: `${API_URL}/api` })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sembung_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !location.pathname.startsWith('/login')) {
      localStorage.removeItem('sembung_token')
      localStorage.removeItem('sembung_user')
      location.href = '/login'
    }
    return Promise.reject(err)
  }
)

/** Turns an axios failure into the Indonesian message the API already returned. */
export const errMsg = (e: unknown, fallback = 'Terjadi kesalahan') => {
  const anyErr = e as { response?: { data?: { message?: string } } }
  return anyErr?.response?.data?.message || fallback
}

export const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

export const tanggal = (d: string | Date, withTime = false) =>
  new Date(d).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
