import axios from 'axios'

// 本番は1サービス構成（Djangoが同一オリジンでAPIも画面も配信する）ため、
// 相対パスを既定値にする。開発時はVite側のプロキシ設定（vite.config.js）が
// /api を http://127.0.0.1:8827 に転送する。
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const TOKEN_KEY = 'reception_auth_tokens'

export function getTokens() {
  const raw = localStorage.getItem(TOKEN_KEY)
  return raw ? JSON.parse(raw) : null
}

export function setTokens(tokens) {
  if (tokens) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

const client = axios.create({ baseURL: API_BASE_URL })

client.interceptors.request.use((config) => {
  const tokens = getTokens()
  if (tokens?.access) {
    config.headers.Authorization = `Bearer ${tokens.access}`
  }
  return config
})

let refreshPromise = null

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error
    if (response?.status !== 401 || config._retry) {
      throw error
    }

    const tokens = getTokens()
    if (!tokens?.refresh) {
      setTokens(null)
      throw error
    }

    config._retry = true
    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${API_BASE_URL}/auth/refresh/`, { refresh: tokens.refresh })
          .finally(() => {
            refreshPromise = null
          })
      }
      const { data } = await refreshPromise
      setTokens({ ...tokens, access: data.access })
      config.headers.Authorization = `Bearer ${data.access}`
      return client(config)
    } catch (refreshError) {
      setTokens(null)
      throw refreshError
    }
  }
)

export default client
