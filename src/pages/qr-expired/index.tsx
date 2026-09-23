import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

import './index.css'

export default function QrExpiredPage() {
  return <View className='qr-expired-page'>
    <View className='qr-expired-icon'>!</View>
    <Text className='qr-expired-title'>二维码已失效</Text>
    <Text className='qr-expired-description'>该二维码已过期或被停用，无法继续使用。请重新获取有效入口。</Text>
    <View className='qr-expired-reasons'><Text>可能的原因</Text><Text>二维码超过有效时间</Text><Text>二维码已被管理员停用</Text><Text>页面已过期，需要重新获取</Text></View>
    <Button onClick={() => Taro.reLaunch({ url: '/pages/home/index' })}>返回首页</Button>
  </View>
}
