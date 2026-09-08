import { Picker, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'

import './index.css'

const REGION_STORAGE_KEY = 'insurance-selected-region'
const DEFAULT_REGION = ['河北省', '保定市', '竞秀区']

export type HeaderLayout = {
  statusBarHeight: number
  navigationHeight: number
  rightPadding: number
}

const DEFAULT_HEADER_LAYOUT: HeaderLayout = {
  statusBarHeight: 20,
  navigationHeight: 44,
  rightPadding: 105
}

function getInitialRegion(): string[] {
  const savedRegion = Taro.getStorageSync<string[]>(REGION_STORAGE_KEY)
  return Array.isArray(savedRegion) && savedRegion.length === 3 ? savedRegion : DEFAULT_REGION
}

export function getHeaderLayout(): HeaderLayout {
  try {
    const windowInfo = Taro.getWindowInfo()
    const menuButton = Taro.getMenuButtonBoundingClientRect()
    const statusBarHeight = windowInfo.statusBarHeight || DEFAULT_HEADER_LAYOUT.statusBarHeight

    if (!menuButton.width || !menuButton.height || menuButton.top < statusBarHeight) {
      return DEFAULT_HEADER_LAYOUT
    }

    const capsuleTopGap = menuButton.top - statusBarHeight

    return {
      statusBarHeight,
      // 上下间距保持一致，使左侧定位内容与原生胶囊垂直居中。
      navigationHeight: menuButton.height + capsuleTopGap * 2,
      // 原生胶囊左边界以右的区域全部留空，并额外保留 12px 间距。
      rightPadding: windowInfo.windowWidth - menuButton.left + 12
    }
  } catch {
    return DEFAULT_HEADER_LAYOUT
  }
}

export default function LocationHeader() {
  const [region, setRegion] = useState<string[]>(getInitialRegion)
  const [headerLayout] = useState<HeaderLayout>(getHeaderLayout)

  const changeRegion = (event: { detail: { value: string[] } }) => {
    const nextRegion = event.detail.value
    setRegion(nextRegion)
    Taro.setStorageSync(REGION_STORAGE_KEY, nextRegion)
  }

  return (
    <View className='location-header'>
      <View className='location-safe-area' style={{ height: `${headerLayout.statusBarHeight}px` }} />
      <View
        className='location-header-row'
        style={{
          height: `${headerLayout.navigationHeight}px`,
          paddingRight: `${headerLayout.rightPadding}px`
        }}
      >
        <Picker mode='region' value={region} onChange={changeRegion}>
          <View className='location-picker'>
            <View className='location-pin'>
              <View className='location-pin-dot' />
            </View>
            <Text className='location-text'>{region.join('')}</Text>
            <View className='location-chevron' />
          </View>
        </Picker>
      </View>
    </View>
  )
}
