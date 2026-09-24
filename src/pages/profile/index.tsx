import { Button, Image, Input, Picker, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'

import { fetchUserProfile, getUserProfile, hasProfileUserId, saveUserProfile, UserProfile } from '../../services/profile'
import { getAuthSession, hasAuthSession } from '../../services/session'

import './index.css'

const genderOptions: UserProfile['gender'][] = ['男', '女', '未知']

export default function ProfilePage() {
  const [profile, setProfile] = useState(getUserProfile)
  const [saving, setSaving] = useState(false)
  const canEdit = hasProfileUserId()
  useDidShow(() => {
    if (!hasAuthSession()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    setProfile(getUserProfile())
    if (hasProfileUserId()) {
      void fetchUserProfile().then(setProfile).catch((error) => {
        Taro.showToast({ title: error instanceof Error ? error.message : '个人信息加载失败', icon: 'none' })
      })
    }
  })

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  const save = async () => {
    if (saving || !canEdit) return
    if (profile.nickname.trim().length > 20) {
      Taro.showToast({ title: '昵称不能超过20字', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await saveUserProfile({ ...profile, nickname: profile.nickname.trim() })
      Taro.showToast({ title: '个人信息已保存', icon: 'success' })
      Taro.navigateBack()
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='profile-page'>
      {!canEdit && <Text className='profile-unavailable'>服务端尚未返回用户标识，个人信息暂无法读取或修改。</Text>}
      <View className='profile-card'>
        <View className='profile-avatar-row' onClick={() => canEdit && Taro.navigateTo({ url: '/pages/avatar/index' })}>
          <View className='profile-avatar-preview'>
            {profile.avatarUrl ? <Image src={profile.avatarUrl} mode='aspectFill' /> : <Text>用</Text>}
          </View>
          <View><Text className='profile-display-name'>{profile.nickname || '未设置昵称'}</Text><Text className='profile-avatar-hint'>{canEdit ? '点击更换头像 ›' : '头像暂无法修改'}</Text></View>
        </View>
        <View className='profile-field'><Text>昵称</Text><Input disabled={!canEdit} maxlength={20} placeholder='请输入昵称' value={profile.nickname} onInput={(event) => update('nickname', event.detail.value)} /></View>
        <View className='profile-field'><Text>手机号</Text><Text className='profile-readonly'>{profile.phone || (getAuthSession()?.phoneBound ? '已绑定（号码未返回）' : '暂未绑定')}</Text></View>
        <Picker disabled={!canEdit} mode='selector' range={genderOptions} onChange={(event) => update('gender', genderOptions[Number(event.detail.value)])}>
          <View className='profile-field'><Text>性别</Text><Text className='profile-value'>{profile.gender} ›</Text></View>
        </Picker>
        <Picker disabled={!canEdit} mode='date' value={profile.birthday || '2000-01-01'} onChange={(event) => update('birthday', String(event.detail.value))}>
          <View className='profile-field'><Text>生日</Text><Text className='profile-value'>{profile.birthday || '请选择'} ›</Text></View>
        </Picker>
        <View className='profile-field'><Text>微信号</Text><Input disabled={!canEdit} placeholder='请输入微信号' value={profile.wxAccount} onInput={(event) => update('wxAccount', event.detail.value)} /></View>
      </View>
      <Button className='profile-save' loading={saving} disabled={saving || !canEdit} onClick={save}>保存</Button>
    </View>
  )
}
