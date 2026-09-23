import { Button, Image, Input, Picker, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'

import { getUserProfile, saveUserProfile, UserProfile } from '../../services/profile'

import './index.css'

const genderOptions: UserProfile['gender'][] = ['男', '女', '未知']

export default function ProfilePage() {
  const [profile, setProfile] = useState(getUserProfile)
  useDidShow(() => setProfile((current) => ({ ...current, avatarUrl: getUserProfile().avatarUrl })))

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  const save = () => {
    if (profile.nickname.trim().length > 20) {
      Taro.showToast({ title: '昵称不能超过20字', icon: 'none' })
      return
    }
    saveUserProfile({ ...profile, nickname: profile.nickname.trim() })
    Taro.showToast({ title: '个人信息已保存', icon: 'success' })
    Taro.navigateBack()
  }

  return (
    <View className='profile-page'>
      <View className='profile-card'>
        <View className='profile-avatar-row' onClick={() => Taro.navigateTo({ url: '/pages/avatar/index' })}>
          <View className='profile-avatar-preview'>
            {profile.avatarUrl ? <Image src={profile.avatarUrl} mode='aspectFill' /> : <Text>用</Text>}
          </View>
          <View><Text className='profile-display-name'>{profile.nickname || '未设置昵称'}</Text><Text className='profile-avatar-hint'>点击更换头像 ›</Text></View>
        </View>
        <View className='profile-field'><Text>昵称</Text><Input maxlength={20} placeholder='请输入昵称' value={profile.nickname} onInput={(event) => update('nickname', event.detail.value)} /></View>
        <View className='profile-field'><Text>手机号</Text><Text className='profile-readonly'>暂未获取</Text></View>
        <Picker mode='selector' range={genderOptions} onChange={(event) => update('gender', genderOptions[Number(event.detail.value)])}>
          <View className='profile-field'><Text>性别</Text><Text className='profile-value'>{profile.gender} ›</Text></View>
        </Picker>
        <Picker mode='date' value={profile.birthday || '2000-01-01'} onChange={(event) => update('birthday', String(event.detail.value))}>
          <View className='profile-field'><Text>生日</Text><Text className='profile-value'>{profile.birthday || '请选择'} ›</Text></View>
        </Picker>
        <View className='profile-field'><Text>微信号</Text><Text className='profile-readonly'>暂未获取</Text></View>
      </View>
      <Button className='profile-save' onClick={save}>保存</Button>
    </View>
  )
}
