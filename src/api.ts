import type { ConnectionConfig, IndexCapabilities, IndexSummary, SearchParams, SearchResponse } from './types'

export class MeiliApiError extends Error {
  status?: number
  code?: string
  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'MeiliApiError'
    this.status = status
    this.code = code
  }
}

export const normalizeHost = (host: string) => host.trim().replace(/\/+$/, '')

export const createMeiliClient = (config: ConnectionConfig) => {
  const host = normalizeHost(config.host)
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(`${host}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
      })
      const text = await response.text()
      let body: any = {}
      try { body = text ? JSON.parse(text) : {} } catch { body = { message: text } }
      if (!response.ok) throw new MeiliApiError(body.message || `请求失败（${response.status}）`, response.status, body.code)
      return body as T
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new MeiliApiError('请求超时，请检查地址和网络。')
      if (error instanceof TypeError) throw new MeiliApiError('无法连接。请检查 URL、CORS 设置或网络。')
      throw error
    } finally { globalThis.clearTimeout(timeout) }
  }

  return {
    host,
    listIndexes: () => request<{ results: IndexSummary[] }>('/indexes?limit=1000'),
    getSettings: (uid: string) => request<IndexCapabilities>(`/indexes/${encodeURIComponent(uid)}/settings`),
    search: (uid: string, params: SearchParams) => request<SearchResponse>(`/indexes/${encodeURIComponent(uid)}/search`, { method: 'POST', body: JSON.stringify(params) }),
  }
}
