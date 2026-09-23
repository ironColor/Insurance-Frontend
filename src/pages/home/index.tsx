import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'

import BottomNavigation from '../../components/bottom-navigation'
import LocationHeader from '../../components/location-header'
import insuranceBanner from '../../assets/images/home-insurance-banner.jpg'
import { hasAuthSession } from '../../services/session'

import './index.css'

const partners = [
  { name: '中国人保', sub: 'PICC', color: '#d53a32' },
  { name: '中国人寿', sub: 'CHINA LIFE', color: '#168d74' },
  { name: '太平洋保险', sub: 'CPIC', color: '#286bb2' },
  { name: '中国平安', sub: 'PING AN', color: '#e36d23' },
  { name: '紫金保险', sub: 'ZKI', color: '#7044a0' },
  { name: '中国大地保险', sub: 'CCIC', color: '#246d8d' },
  { name: '泰康保险', sub: 'TAIKANG', color: '#159989' },
  { name: '阳光保险', sub: 'SUNSHINE', color: '#d69a32' }
]

const showDeveloping = (title: string) => {
  Taro.showToast({ title: `${title}功能建设中`, icon: 'none' })
}

export default function HomePage() {
  useEffect(() => {
    if (!hasAuthSession()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  }, [])

  const openProduct = () => {
    Taro.navigateTo({ url: '/pages/index/index' })
  }

  return (
    <View className='home-page'>
      <LocationHeader />

      <View className='home-content'>
        <View className='hero-banner' onClick={openProduct}>
          <Image className='hero-banner-image' src={insuranceBanner} mode='aspectFill' />
        </View>

        <View className='quick-entry-grid'>
          <View className='quick-entry' onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
            <View className='quick-entry-icon quick-entry-blue'>
              <Text className='quick-entry-symbol'>▤</Text>
            </View>
            <Text className='quick-entry-name'>订单/保单</Text>
          </View>
          <View className='quick-entry' onClick={() => showDeveloping('理赔报案')}>
            <View className='quick-entry-icon quick-entry-teal'>
              <Text className='quick-entry-symbol'>!</Text>
            </View>
            <Text className='quick-entry-name'>理赔报案</Text>
          </View>
          <View className='quick-entry' onClick={() => showDeveloping('常见问题')}>
            <View className='quick-entry-icon quick-entry-orange'>
              <Text className='quick-entry-symbol'>?</Text>
            </View>
            <Text className='quick-entry-name'>常见问题</Text>
          </View>
        </View>

        <View className='home-divider' />

        <View className='section-heading'>
          <View>
            <Text className='section-title'>热门产品</Text>
            <View className='section-title-underline' />
          </View>
          <Text className='section-more' onClick={openProduct}>查看方案 ›</Text>
        </View>

        <View className='product-list'>
          <View className='product-card' onClick={openProduct}>
            <View className='product-icon product-icon-blue'><Text>◆</Text></View>
            <View className='product-info'>
              <Text className='product-name'>学生保险保障方案</Text>
              <Text className='product-description'>查看学平险及可选的监护人责任险方案</Text>
            </View>
            <View className='insure-button'>查看详情</View>
          </View>
        </View>

        <View className='section-heading partner-heading'>
          <View>
            <Text className='section-title'>合作保险公司</Text>
            <Text className='section-subtitle'>与多家知名保险机构深度合作，保障更安心</Text>
          </View>
        </View>

        <ScrollView className='partner-scroll' scrollX>
          <View className='partner-grid'>
            {partners.map((partner) => (
              <View className='partner-item' key={partner.name}>
                <Text className='partner-sub' style={{ color: partner.color }}>{partner.sub}</Text>
                <Text className='partner-name'>{partner.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View className='home-slogan'>
          <View className='slogan-shield'>✓</View>
          <Text>安心保 · 安心保障每一家</Text>
        </View>
      </View>

      <BottomNavigation active='home' />
    </View>
  )
}
