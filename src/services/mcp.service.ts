import axios, { AxiosError } from 'axios'

/**
 * Portal del conector MCP (/mcp). Va aparte de la app interna: su propia sesión
 * (`mcp_portal_token`) y sin el interceptor de 401 de APIBase, para no abrir el modal
 * de "sesión vencida" de ventas.
 */
const raw = (import.meta.env.VITE_NICOLE_API as string) || 'http://localhost:8101/api'
const trimmed = raw.replace(/\/+$/, '')
const BASE = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
const TOKEN_KEY = 'mcp_portal_token'

export interface McpUser {
  _id: string
  email: string
  name: string
  active: boolean
  canManage: boolean
  lastLoginAt: string | null
  lastMcpAt: string | null
  createdBy: string
  connectorToken?: string
}

export const mcpSession = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export function connectorUrl(token: string) {
  return `${BASE}/mcp/${token}`
}

/** URL única del conector (OAuth): Claude manda a cada persona a iniciar sesión aquí. */
export const CONNECTOR_URL = `${BASE}/mcp`

async function call<T>(method: 'get' | 'post' | 'patch' | 'delete', path: string, data?: unknown): Promise<T> {
  try {
    const token = mcpSession.get()
    const res = await axios.request<T>({
      method,
      url: `${BASE}/mcp-portal${path}`,
      data,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 30000,
    })
    return res.data
  } catch (e) {
    const err = e as AxiosError<{ message?: string }>
    const status = err.response?.status
    if (status === 401 && path !== '/login' && path !== '/verify') mcpSession.clear()
    throw Object.assign(new Error(err.response?.data?.message || 'No pudimos conectar. Revisa tu internet.'), { status })
  }
}

export const mcpService = {
  login: (email: string, password: string) => call<{ sent: boolean; email: string }>('post', '/login', { email, password }),
  verify: (email: string, code: string) => call<{ token: string; user: McpUser }>('post', '/verify', { email, code }),
  me: () => call<McpUser>('get', '/me'),
  regenerateMine: () => call<McpUser>('post', '/me/connector'),
  users: () => call<McpUser[]>('get', '/users'),
  createUser: (body: { email: string; name: string; password: string; canManage: boolean }) => call<McpUser>('post', '/users', body),
  updateUser: (id: string, body: Partial<{ active: boolean; canManage: boolean; password: string; name: string; regenerateConnector: boolean }>) =>
    call<McpUser>('patch', `/users/${id}`, body),
  deleteUser: (id: string) => call<{ deleted: boolean }>('delete', `/users/${id}`),
  oauthCheck: (query: string) => call<{ clientName: string }>('get', `/oauth/check?${query}`),
  oauthApprove: (params: Record<string, string>) => call<{ redirectTo: string }>('post', '/oauth/approve', params),
}
