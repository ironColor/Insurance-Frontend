import { Text, View } from '@tarojs/components'

export default function CurrentRegion() {
  // 当前 AppID 尚未开通模糊定位权限；恢复前不接入定位服务，避免上传校验失败。
  return <View className='location-bar'>
    <View className='location-mark'><View className='location-dot' /></View>
    <Text className='location-name'>当前位置：未定位</Text>
  </View>
}
