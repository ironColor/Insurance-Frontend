import Taro from '@tarojs/taro'

import { AuthSession, clearAuthSession, getAuthSession } from './session'
import { parseApiJson } from './json'

export const API_BASE_URL = 'https://www.zfxbaoxian.com/prod-api/wxmini'

export type ApiResponse<T> = { code?: number; msg?: string; data?: T }

export class ApiError extends Error {
  constructor(message: string, public code?: number, public statusCode?: number) {
    super(message)
    this.name = 'ApiError'
  }
}

function authHeader(session: AuthSession): Record<string, string> {
  const token = session.headerName.toLowerCase() === 'wx-authorization' && !/^Bearer\s/i.test(session.token)
    ? `Bearer ${session.token}`
    : session.token
  return { [session.headerName]: token }
}

export function unwrapResponse<T>(body: ApiResponse<T> | string, statusCode: number): T {
  if (body == null || (typeof body !== 'string' && (typeof body !== 'object' || Array.isArray(body)))) {
    if (statusCode === 401 || statusCode === 403) clearAuthSession()
    throw new ApiError('服务返回内容异常', undefined, statusCode)
  }
  if (statusCode === 401 || statusCode === 403 || (typeof body !== 'string' && body.code === 401)) {
    clearAuthSession()
    throw new ApiError(typeof body === 'string' ? body || '登录已失效，请重新登录' : body.msg || '登录已失效，请重新登录', typeof body === 'string' ? undefined : body.code, statusCode)
  }
  if (statusCode < 200 || statusCode >= 300) {
    throw new ApiError(typeof body === 'string' ? body : body.msg || `服务请求失败（${statusCode}）`, typeof body === 'string' ? undefined : body.code, statusCode)
  }
  if (typeof body === 'string') throw new Error(body || '服务返回内容异常')
  if (body.code !== undefined && body.code !== 200) throw new ApiError(body.msg || '服务请求失败', body.code, statusCode)
  return body.data as T
}

export async function apiRequest<T>(path: string, method: 'GET' | 'POST' | 'PUT', data?: object): Promise<T> {
  const session = getAuthSession()
  const response = await Taro.request<string>({
    url: `${API_BASE_URL}${path}`,
    method,
    data,
    dataType: 'text',
    responseType: 'text',
    timeout: 15000,
    header: {
      'Content-Type': 'application/json',
      ...(session ? authHeader(session) : {})
    }
  })
  let body: ApiResponse<T> | string = response.data
  if (typeof body === 'string') {
    try {
      body = parseApiJson(body) as ApiResponse<T>
    } catch {
      // 非 JSON 错误响应仍交由统一响应处理显示。
    }
  }
  return unwrapResponse(body, response.statusCode)
}

export async function apiUpload<T>(path: string, filePath: string): Promise<T> {
  const session = getAuthSession()
  if (!session) throw new Error('请先登录')
  const response = await Taro.uploadFile({
    url: `${API_BASE_URL}${path}`,
    filePath,
    name: 'file',
    timeout: 30000,
    header: authHeader(session)
  })
  if (response.statusCode === 401 || response.statusCode === 403) {
    return unwrapResponse<T>(response.data, response.statusCode)
  }
  let body: ApiResponse<T>
  try {
    body = parseApiJson(response.data) as ApiResponse<T>
  } catch {
    throw new Error('上传服务返回内容异常')
  }
  return unwrapResponse(body, response.statusCode)
}
