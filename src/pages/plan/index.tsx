import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

import './index.css'

export default function PlanPage() {
  return (
    <View className='plan-page'>
      <View className='plan-card'>
        <Text className='plan-step'>下一步</Text>
        <Text className='plan-title'>方案详情</Text>
        <Text className='plan-description'>产品介绍页的协议校验已通过，可在此接入方案列表与投保流程。</Text>
        <Button className='plan-back' onClick={() => Taro.navigateBack()}>
          返回产品介绍
        </Button>
      </View>
    </View>
  )
}
