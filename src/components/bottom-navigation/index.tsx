import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

import './index.css'

type BottomNavigationProps = {
  active: 'home' | 'mine'
}

export default function BottomNavigation({ active }: BottomNavigationProps) {
  const changePage = (target: BottomNavigationProps['active']) => {
    if (target === active) return

    Taro.redirectTo({
      url: target === 'home' ? '/pages/home/index' : '/pages/mine/index'
    })
  }

  return (
    <View className='bottom-navigation'>
      <View className={`navigation-item ${active === 'home' ? 'navigation-item-active' : ''}`} onClick={() => changePage('home')}>
        <View className='home-navigation-icon'>
          <View className='home-navigation-roof' />
          <View className='home-navigation-body' />
        </View>
        <Text className='navigation-label'>首页</Text>
      </View>

      <View className={`navigation-item ${active === 'mine' ? 'navigation-item-active' : ''}`} onClick={() => changePage('mine')}>
        <View className='mine-navigation-icon'>
          <View className='mine-navigation-head' />
          <View className='mine-navigation-body' />
        </View>
        <Text className='navigation-label'>我的</Text>
      </View>
    </View>
  )
}

