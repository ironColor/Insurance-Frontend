import Taro from '@tarojs/taro'

import { apiRequest } from './api'
import { clearAuthSession, saveAuthSession, userIdFromToken } from './session'

const CLIENT_ID = '71f081db718ae2e719a9063f0444ab67'

export type LoginResult = { phone?: string; userId?: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function readId(value: unknown): string | undefined {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : undefined
}

function extractLogin(data: unknown): { token: string; headerName: string; userId?: string } {
  const record = asRecord(data)
  const nested = asRecord(record?.userInfo) || asRecord(record?.user) || asRecord(record?.wxUser)
  const token = readString(record?.apiToken) || readString(data) || readString(record?.access_token) || readString(record?.accessToken) || readString(record?.token)
  if (!token) throw new Error('登录服务未返回令牌')
  return {
    token,
    headerName: readString(record?.header) || 'Wx-Authorization',
    userId: readId(record?.userId) || readId(nested?.userId) || userIdFromToken(token)
  }
}

/** 微信 code 换取业务令牌，再用手机号动态令牌完成绑定。 */
export async function loginWithWechat(phoneCode: string): Promise<LoginResult> {
  const result = await Taro.login({ timeout: 10000 })
  if (!result.code) throw new Error('未获取到微信登录凭证')

  const loginData = await apiRequest<unknown>('/login', 'POST', {
    appid: Taro.getAccountInfoSync().miniProgram.appId,
    xcxCode: result.code,
    clientId: CLIENT_ID
  })
  const session = extractLogin(loginData)
  saveAuthSession(session)

  try {
    const phoneData = await apiRequest<unknown>(`/user/phone?phoneCode=${encodeURIComponent(phoneCode)}`, 'GET')
    const record = asRecord(phoneData)
    const userId = session.userId || readId(record?.userId)
    saveAuthSession({ ...session, userId, phoneBound: true })
    return { phone: readString(phoneData) || readString(record?.phoneNumber) || readString(record?.phonenumber), userId }
  } catch (error) {
    clearAuthSession()
    throw error
  }
}

export async function logoutFromServer(): Promise<void> {
  await apiRequest<void>('/logout', 'POST')
}
