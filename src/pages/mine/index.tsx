import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'

import BottomNavigation from '../../components/bottom-navigation'
import { getHeaderLayout } from '../../components/location-header'
import { clearAuthSession, hasAuthSession } from '../../services/session'
import { clearUserProfile, fetchUserProfile, getUserProfile, hasProfileUserId } from '../../services/profile'
import { logoutFromServer } from '../../services/auth'
import { INSURANCE_DRAFT_KEY, INSURANCE_ORDERS_KEY } from '../../services/product'

import './index.css'

const showDeveloping = (title: string) => {
  Taro.showToast({ title: `${title}功能建设中`, icon: 'none' })
}

export default function MinePage() {
  const [profile, setProfile] = useState(getUserProfile)
  const [headerLayout] = useState(getHeaderLayout)
  useDidShow(() => {
    setProfile(getUserProfile())
    if (hasAuthSession() && hasProfileUserId()) {
      void fetchUserProfile().then(setProfile).catch((error) => {
        if (!hasAuthSession()) Taro.reLaunch({ url: '/pages/login/index' })
        else Taro.showToast({ title: error instanceof Error ? error.message : '个人信息加载失败', icon: 'none' })
      })
    }
  })

  useEffect(() => {
    if (!hasAuthSession()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  }, [])

  const logout = async () => {
    const result = await Taro.showModal({
      title: '提示',
      content: '确定退出登录？',
      cancelText: '取消',
      confirmText: '确定',
      confirmColor: '#2f80ed'
    })

    if (!result.confirm) return

    try {
      await logoutFromServer()
    } catch (error) {
      console.error('服务端退出登录失败', error)
    }
    clearAuthSession()
    clearUserProfile()
    Taro.removeStorageSync(INSURANCE_DRAFT_KEY)
    Taro.removeStorageSync(INSURANCE_ORDERS_KEY)
    Taro.reLaunch({ url: '/pages/login/index' })
  }

  const openAvatar = () => {
    if (!hasProfileUserId()) {
      Taro.showToast({ title: '服务端未返回用户标识，暂无法修改头像', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: '/pages/avatar/index' })
  }

  return (
    <View className='mine-page'>
      <View
        className='profile-hero'
        style={{ paddingTop: `${headerLayout.statusBarHeight + headerLayout.navigationHeight}px` }}
      >
        <View className='mine-hero-heading'><Text>我的</Text><Text>正方形保险</Text></View>
        <View className='mine-identity'>
          <View className='profile-avatar'>
            {profile.avatarUrl ? <Image className='profile-avatar-image' src={profile.avatarUrl} mode='aspectFill' /> : <Text>用</Text>}
          </View>
          <View className='profile-copy'>
            <Text className='profile-phone'>{profile.nickname || '我的账户'}</Text>
            <Text className='profile-hero-subtitle'>每一份安心，都为你妥善珍藏</Text>
            <Button className='change-avatar-button' onClick={openAvatar}>修改头像</Button>
          </View>
        </View>
      </View>

      <View className='mine-content'>
        <View className='mine-section-heading'><Text>我的服务</Text><Text>便捷管理保障与售后</Text></View>
        <View className='service-shortcuts'>
          <View className='service-shortcut' onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
            <View className='service-shortcut-icon service-blue'>▤</View>
            <Text>订单保单</Text>
          </View>
          <View className='service-shortcut' onClick={() => showDeveloping('理赔报案')}>
            <View className='service-shortcut-icon service-teal'>＋</View>
            <Text>理赔报案</Text>
          </View>
          <View className='service-shortcut' onClick={() => showDeveloping('投诉建议')}>
            <View className='service-shortcut-icon service-orange'>☷</View>
            <Text>投诉建议</Text>
          </View>
          <View className='service-shortcut' onClick={() => showDeveloping('常见问题')}>
            <View className='service-shortcut-icon service-purple'>?</View>
            <Text>常见问题</Text>
          </View>
        </View>

        <View className='mine-section-heading mine-account-heading'><Text>账户与帮助</Text><Text>资料与服务支持</Text></View>
        <View className='mine-menu'>
          <View className='mine-menu-row' onClick={() => Taro.navigateTo({ url: '/pages/profile/index' })}>
            <View className='mine-menu-icon menu-blue'>人</View>
            <Text className='mine-menu-name'>个人信息</Text>
            <Text className='mine-menu-arrow'>›</Text>
          </View>
          <View className='mine-menu-row' onClick={() => showDeveloping('关于我们')}>
            <View className='mine-menu-icon menu-teal'>盾</View>
            <Text className='mine-menu-name'>关于我们</Text>
            <Text className='mine-menu-arrow'>›</Text>
          </View>
          <View className='mine-menu-row' onClick={() => Taro.showToast({ title: '客服电话配置中', icon: 'none' })}>
            <View className='mine-menu-icon menu-orange'>话</View>
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
