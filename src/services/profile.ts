import Taro from '@tarojs/taro'

const PROFILE_STORAGE_KEY = 'insurance-user-profile'

export type UserProfile = {
  avatarUrl: string
  nickname: string
  gender: '男' | '女' | '未知'
  birthday: string
}

const emptyProfile: UserProfile = { avatarUrl: '', nickname: '', gender: '未知', birthday: '' }

export function getUserProfile(): UserProfile {
  const stored = Taro.getStorageSync<Partial<UserProfile>>(PROFILE_STORAGE_KEY)
  return stored && typeof stored === 'object' ? { ...emptyProfile, ...stored } : emptyProfile
}

export function saveUserProfile(profile: UserProfile): void {
  Taro.setStorageSync(PROFILE_STORAGE_KEY, profile)
}

export function clearUserProfile(): void {
  Taro.removeStorageSync(PROFILE_STORAGE_KEY)
}
