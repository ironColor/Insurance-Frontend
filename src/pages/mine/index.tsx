import { Button, Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

import BottomNavigation from '../../components/bottom-navigation'
import { getHeaderLayout } from '../../components/location-header'
import { clearAuthSession, hasAuthSession } from '../../services/session'

import './index.css'

const AVATAR_STORAGE_KEY = 'insurance-user-avatar'

const showDeveloping = (title: string) => {
  Taro.showToast({ title: `${title}功能建设中`, icon: 'none' })
}

export default function MinePage() {
  const [avatarUrl, setAvatarUrl] = useState(() => Taro.getStorageSync<string>(AVATAR_STORAGE_KEY))
  const [headerLayout] = useState(getHeaderLayout)

  useEffect(() => {
    if (!hasAuthSession()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  }, [])

  const changeAvatar = (event: { detail: { avatarUrl?: string } }) => {
    const nextAvatar = event.detail.avatarUrl
    if (!nextAvatar) return

    setAvatarUrl(nextAvatar)
    Taro.setStorageSync(AVATAR_STORAGE_KEY, nextAvatar)
    Taro.showToast({ title: '头像已更新', icon: 'success' })
  }

  const showAbout = () => {
    Taro.showModal({
      title: '关于我们',
      content: '正方形保险致力于为家庭提供简单、透明、安心的保险服务。',
      showCancel: false,
      confirmText: '我知道了'
    })
  }

  const logout = async () => {
    const result = await Taro.showModal({
      title: '提示',
      content: '确定退出登录？',
      cancelText: '取消',
      confirmText: '确定',
      confirmColor: '#2f80ed'
    })

    if (!result.confirm) return

    clearAuthSession()
    Taro.removeStorageSync(AVATAR_STORAGE_KEY)
    Taro.reLaunch({ url: '/pages/login/index' })
  }

  return (
    <View className='mine-page'>
      <View
        className='profile-hero'
        style={{ paddingTop: `${headerLayout.statusBarHeight + headerLayout.navigationHeight}px` }}
      >
        <View className='profile-avatar'>
          {avatarUrl ? <Image className='profile-avatar-image' src={avatarUrl} mode='aspectFill' /> : <Text>用</Text>}
        </View>
        <View className='profile-copy'>
          <Text className='profile-phone'>166****0523</Text>
          <Button className='change-avatar-button' openType='chooseAvatar' onChooseAvatar={changeAvatar}>修改头像</Button>
        </View>
      </View>

      <View className='mine-content'>
        <View className='service-shortcuts'>
          <View className='service-shortcut' onClick={() => showDeveloping('订单/保单')}>
            <View className='service-shortcut-icon service-blue'>▤</View>
            <Text>订单/保单</Text>
          </View>
          <View className='service-shortcut' onClick={() => showDeveloping('理赔报案')}>
            <View className='service-shortcut-icon service-teal'>!</View>
            <Text>理赔报案</Text>
          </View>
          <View className='service-shortcut' onClick={() => showDeveloping('投诉建议')}>
            <View className='service-shortcut-icon service-orange'>▣</View>
            <Text>投诉建议</Text>
          </View>
          <View className='service-shortcut' onClick={() => showDeveloping('常见问题')}>
            <View className='service-shortcut-icon service-purple'>?</View>
            <Text>常见问题</Text>
          </View>
        </View>

        <View className='mine-menu'>
          <View className='mine-menu-row' onClick={() => showDeveloping('个人信息')}>
            <View className='mine-menu-icon menu-blue'>♟</View>
            <Text className='mine-menu-name'>个人信息</Text>
            <Text className='mine-menu-arrow'>›</Text>
          </View>
          <View className='mine-menu-row' onClick={showAbout}>
            <View className='mine-menu-icon menu-teal'>◷</View>
            <Text className='mine-menu-name'>关于我们</Text>
            <Text className='mine-menu-arrow'>›</Text>
          </View>
          <View className='mine-menu-row' onClick={() => Taro.showToast({ title: '客服电话配置中', icon: 'none' })}>
            <View className='mine-menu-icon menu-orange'>⌕</View>
            <Text className='mine-menu-name'>客服电话</Text>
            <Text className='mine-menu-arrow'>›</Text>
          </View>
        </View>

        <Button className='logout-button' hoverClass='logout-button-hover' onClick={logout}>
          退出登录
        </Button>
      </View>

      <BottomNavigation active='mine' />
    </View>
  )
}
