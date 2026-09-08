import Taro from '@tarojs/taro'

const AUTH_SESSION_STORAGE_KEY = 'insurance-auth-session'

export type AuthSession = {
  authenticatedAt: number
}

export function saveAuthSession(): void {
  Taro.setStorageSync(AUTH_SESSION_STORAGE_KEY, {
    authenticatedAt: Date.now()
  })
}

export function hasAuthSession(): boolean {
  const session = Taro.getStorageSync<AuthSession>(AUTH_SESSION_STORAGE_KEY)
  return Boolean(session && typeof session.authenticatedAt === 'number')
}

export function clearAuthSession(): void {
  Taro.removeStorageSync(AUTH_SESSION_STORAGE_KEY)
}
