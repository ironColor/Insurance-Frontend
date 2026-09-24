import Taro from '@tarojs/taro'

const AUTH_SESSION_STORAGE_KEY = 'insurance-auth-session'

export type AuthSession = {
  token: string
  headerName: string
  userId?: string
  phoneBound?: boolean
}

/** 登录响应没有 userId 时，从服务端签发的 JWT 中读取用户标识。 */
export function userIdFromToken(token: string): string | undefined {
  const payload = token.replace(/^Bearer\s+/i, '').split('.')[1]
  if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload)) return undefined

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payload.length % 4) % 4)
    const bytes = new Uint8Array(Taro.base64ToArrayBuffer(base64))
    const json = decodeURIComponent(Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''))
    JSON.parse(json)
    const match = json.match(/"userId"\s*:\s*(?:"([1-9]\d*)"|([1-9]\d*))(?=\s*[,}])/)
    return match?.[1] || match?.[2]
  } catch {
    return undefined
  }
}

export function getAuthSession(): AuthSession | null {
  const value = Taro.getStorageSync<Partial<AuthSession>>(AUTH_SESSION_STORAGE_KEY)
  if (!value || typeof value.token !== 'string' || !value.token) return null
  return {
    token: value.token,
    headerName: value.headerName || 'Wx-Authorization',
    userId: value.userId ? String(value.userId) : userIdFromToken(value.token),
    phoneBound: value.phoneBound === true
  }
}

export function saveAuthSession(session: AuthSession): void {
  Taro.setStorageSync(AUTH_SESSION_STORAGE_KEY, session)
}

export function hasAuthSession(): boolean {
  return getAuthSession() !== null
}

export function clearAuthSession(): void {
  Taro.removeStorageSync(AUTH_SESSION_STORAGE_KEY)
}
