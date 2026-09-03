import { Text, View } from '@tarojs/components'

import './index.css'

export default function Index() {
  return (
    <View className='page'>
      <View className='hero'>
        <Text className='eyebrow'>INSURANCE SERVICE</Text>
        <Text className='title'>让保障更简单</Text>
        <Text className='description'>Taro 4.2 + React 18 + TypeScript + Vite</Text>
      </View>

      <View className='card'>
        <Text className='card-title'>项目已准备就绪</Text>
        <Text className='card-description'>现在可以从这个页面开始构建你的微信小程序。</Text>
      </View>
    </View>
  )
}

