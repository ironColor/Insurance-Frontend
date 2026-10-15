import { Button, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'

import { getRegionOptions, getRegionPath, RegionOption } from '../../services/region-data'

import './index.css'

const REGION_STORAGE_KEY = 'insurance-selected-region'
const DEFAULT_REGION = ['河北省', '保定市', '竞秀区']
const REGION_LEVEL_LABELS = ['省份', '城市', '区县']

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
  if (Array.isArray(savedRegion) && savedRegion.length > 0 && savedRegion.length <= 3 && savedRegion.every((name) => typeof name === 'string')) {
    const savedPath = getRegionPath(savedRegion)
    const lastRegion = savedPath[savedPath.length - 1]
    if (lastRegion && savedPath.length === savedRegion.length && (savedPath.length === 3 || getRegionOptions(lastRegion.code).length === 0)) {
      return savedRegion
    }
  }
  return DEFAULT_REGION
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
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [draftPath, setDraftPath] = useState<RegionOption[]>([])
  const [activeLevel, setActiveLevel] = useState(0)

  const lastDraftRegion = draftPath[draftPath.length - 1]
  const hasNextLevel = Boolean(lastDraftRegion && draftPath.length < 3 && getRegionOptions(lastDraftRegion.code).length > 0)
  const visibleLevelCount = Math.min(Math.max(draftPath.length + (hasNextLevel ? 1 : 0), 1), REGION_LEVEL_LABELS.length)
  const parentRegion = draftPath[activeLevel - 1]
  const options = activeLevel === 0 || parentRegion ? getRegionOptions(parentRegion?.code) : []
  const selectedCode = draftPath[activeLevel]?.code
  const canConfirm = Boolean(lastDraftRegion && !hasNextLevel)

  const openSelector = () => {
    const currentPath = getRegionPath(region)
    setDraftPath(currentPath)
    setActiveLevel(Math.min(Math.max(currentPath.length - 1, 0), REGION_LEVEL_LABELS.length - 1))
    setSelectorOpen(true)
  }

  const selectRegion = (option: RegionOption) => {
    // 返回上一级后重新选择时，仅在地区变化时清空下级草稿。
    const nextPath = selectedCode === option.code ? draftPath : [...draftPath.slice(0, activeLevel), option]
    setDraftPath(nextPath)
    if (activeLevel < REGION_LEVEL_LABELS.length - 1 && getRegionOptions(option.code).length > 0) {
      setActiveLevel(Math.min(activeLevel + 1, REGION_LEVEL_LABELS.length - 1))
    }
  }

  const confirmRegion = () => {
    if (!canConfirm) return
    const nextRegion = draftPath.map((option) => option.name)
    setRegion(nextRegion)
    Taro.setStorageSync(REGION_STORAGE_KEY, nextRegion)
    setSelectorOpen(false)
  }

  return (
    <>
      <View className='location-header'>
        <View className='location-safe-area' style={{ height: `${headerLayout.statusBarHeight}px` }} />
        <View
          className='location-header-row'
          style={{
            height: `${headerLayout.navigationHeight}px`,
            paddingRight: `${headerLayout.rightPadding}px`
          }}
        >
          <View className='location-picker' onClick={openSelector}>
            <View className='location-pin'>
              <View className='location-pin-dot' />
            </View>
            <View className='location-copy'><Text className='location-label'>当前服务地区</Text><Text className='location-text'>{region.join('')}</Text></View>
            <View className='location-chevron' />
          </View>
        </View>
      </View>

      {selectorOpen && (
        <View className='region-selector-mask' catchMove onClick={() => setSelectorOpen(false)}>
          <View className='region-selector-panel' onClick={(event) => event.stopPropagation()}>
            <View className='region-selector-heading'>
              <View className='region-selector-heading-copy'>
                <Text className='region-selector-title'>选择服务地区</Text>
                <Text className='region-selector-description'>依次点选省份、城市和区县</Text>
              </View>
              <Button className='region-selector-close' onClick={() => setSelectorOpen(false)} ariaLabel='关闭地区选择'>×</Button>
            </View>

            <View className='region-selector-path'>
              {REGION_LEVEL_LABELS.slice(0, visibleLevelCount).map((label, level) => (
                <View
                  key={label}
                  className={`region-selector-step ${activeLevel === level ? 'region-selector-step-active' : ''}`}
                  onClick={() => setActiveLevel(level)}
                >
                  <Text className='region-selector-step-label'>{label}</Text>
                  <Text className='region-selector-step-name'>{draftPath[level]?.name || `请选择${label}`}</Text>
                </View>
              ))}
            </View>

            <ScrollView
              key={`${activeLevel}-${parentRegion?.code || 'province'}`}
              className='region-selector-options'
              scrollY
              scrollIntoView={selectedCode ? `region-option-${selectedCode}` : undefined}
            >
              {options.map((option) => (
                <View
                  id={`region-option-${option.code}`}
                  key={option.code}
                  className={`region-selector-option ${selectedCode === option.code ? 'region-selector-option-selected' : ''}`}
                  onClick={() => selectRegion(option)}
                >
                  <Text className='region-selector-option-name'>{option.name}</Text>
                  {selectedCode === option.code && <Text className='region-selector-check'>✓</Text>}
                </View>
              ))}
            </ScrollView>

            <View className='region-selector-actions'>
              <Button className='region-selector-action region-selector-cancel' onClick={() => setSelectorOpen(false)}>取消</Button>
              <Button className='region-selector-action region-selector-confirm' disabled={!canConfirm} onClick={confirmRegion}>确认地区</Button>
            </View>
          </View>
        </View>
      )}
    </>
  )
}
