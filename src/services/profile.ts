import Taro from '@tarojs/taro'

import { apiRequest, apiUpload } from './api'
import { getAuthSession, saveAuthSession } from './session'

const PROFILE_STORAGE_KEY = 'insurance-user-profile'

export type UserProfile = {
  avatarUrl: string
  nickname: string
  gender: '男' | '女' | '未知'
  birthday: string
  phone: string
  wxAccount: string
  userId?: string
}

type WxUserVo = {
  userId?: number | string
  nickName?: string
  phonenumber?: string
  wxAccount?: string
  sex?: string
  birth?: string
  avatar?: string
}

type RemoteFile = { url?: string }

const emptyProfile: UserProfile = { avatarUrl: '', nickname: '', gender: '未知', birthday: '', phone: '', wxAccount: '' }

const genderFromCode = (code?: string): UserProfile['gender'] => code === '0' ? '男' : code === '1' ? '女' : '未知'
const genderToCode = (gender: UserProfile['gender']) => gender === '男' ? '0' : gender === '女' ? '1' : '2'

export function getUserProfile(): UserProfile {
  const stored = Taro.getStorageSync<Partial<UserProfile>>(PROFILE_STORAGE_KEY)
  return stored && typeof stored === 'object' ? { ...emptyProfile, ...stored } : emptyProfile
}

export function cacheUserProfile(profile: UserProfile): void {
  Taro.setStorageSync(PROFILE_STORAGE_KEY, profile)
}

export function cachePhone(phone?: string, userId?: string): void {
  const current = getUserProfile()
  cacheUserProfile({ ...current, phone: phone || current.phone, userId: userId || current.userId })
}

export function hasProfileUserId(): boolean {
  return Boolean(getAuthSession()?.userId || getUserProfile().userId)
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const session = getAuthSession()
  const userId = session?.userId || getUserProfile().userId
  if (!session) throw new Error('请先登录')
  if (!userId) throw new Error('服务端未返回用户标识，暂无法读取个人信息')
  const user = await apiRequest<WxUserVo>(`/user/${encodeURIComponent(userId)}`, 'GET')
  if (!user) throw new Error('用户资料为空')
  const profile: UserProfile = {
    userId: String(user.userId || userId),
    avatarUrl: user.avatar || '',
    nickname: user.nickName || '',
    gender: genderFromCode(user.sex),
    birthday: user.birth?.slice(0, 10) || '',
    phone: user.phonenumber || getUserProfile().phone,
    wxAccount: user.wxAccount || ''
  }
  cacheUserProfile(profile)
  if (!session.userId) saveAuthSession({ ...session, userId: profile.userId })
  return profile
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const userId = getAuthSession()?.userId || profile.userId
  if (!userId) throw new Error('服务端未返回用户标识，暂无法保存个人信息')
  await apiRequest<void>('/user', 'PUT', {
    userId,
    nickName: profile.nickname.trim(),
    wxAccount: profile.wxAccount.trim(),
    sex: genderToCode(profile.gender),
    birth: profile.birthday,
    avatar: profile.avatarUrl
  })
  cacheUserProfile({ ...profile, userId, nickname: profile.nickname.trim(), wxAccount: profile.wxAccount.trim() })
}

export async function uploadUserAvatar(filePath: string): Promise<string> {
  if (!hasProfileUserId()) throw new Error('服务端未返回用户标识，暂无法修改头像')
  const file = await apiUpload<RemoteFile>('/user/upload', filePath)
  if (!file?.url) throw new Error('上传服务未返回头像地址')
  return file.url
}

export function clearUserProfile(): void {
  Taro.removeStorageSync(PROFILE_STORAGE_KEY)
}
