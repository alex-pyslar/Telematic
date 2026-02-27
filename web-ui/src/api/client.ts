const BASE = ''

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const data = await res.json()
      msg = data.error ?? msg
    } catch {}
    throw new Error(msg)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ ok: boolean }>('POST', '/api/auth/login', { username, password }),
    logout: () => request<{ ok: boolean }>('POST', '/api/auth/logout'),
    me: () => request<{ username: string }>('GET', '/api/auth/me'),
  },

  bots: {
    list: () => request<import('@/types').BotSnapshot[]>('GET', '/api/bots'),
    get: (id: string) => request<import('@/types').Bot>('GET', `/api/bots/${id}`),
    create: (bot: Partial<import('@/types').Bot>) =>
      request<import('@/types').Bot>('POST', '/api/bots', bot),
    update: (id: string, bot: Partial<import('@/types').Bot>) =>
      request<import('@/types').Bot>('PUT', `/api/bots/${id}`, bot),
    delete: (id: string) => request<void>('DELETE', `/api/bots/${id}`),
    start: (id: string) => request<{ ok: boolean }>('POST', `/api/bots/${id}/start`),
    stop: (id: string) => request<{ ok: boolean }>('POST', `/api/bots/${id}/stop`),
    restart: (id: string) => request<{ ok: boolean }>('POST', `/api/bots/${id}/restart`),
    logs: (id: string) => request<string[]>('GET', `/api/bots/${id}/logs`),
  },

  assets: {
    list: (botId: string) => request<import('@/types').Asset[]>('GET', `/api/bots/${botId}/assets`),
    upload: (botId: string, file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return upload<import('@/types').Asset>(`/api/bots/${botId}/assets`, fd)
    },
    uploadWelcome: (botId: string, file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return upload<{ key: string; url: string }>(`/api/bots/${botId}/welcome`, fd)
    },
    delete: (botId: string, key: string) =>
      request<void>('DELETE', `/api/bots/${botId}/assets/${encodeURIComponent(key)}`),
  },

  // Export / Import
  exportURL: (format: 'json' | 'zip' = 'json') =>
    `/api/export${format === 'zip' ? '?format=zip' : ''}`,

  importJSON: (data: unknown) =>
    request<import('@/types').ImportResult>('POST', '/api/import', data),

  importZIP: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return upload<import('@/types').ImportResult>('/api/import/zip', fd)
  },
}
