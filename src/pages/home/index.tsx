import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'

import BottomNavigation from '../../components/bottom-navigation'
import LocationHeader from '../../components/location-header'
import insuranceBanner from '../../assets/images/home-insurance-banner.jpg'
import { hasAuthSession } from '../../services/session'

import './index.css'

type Product = {
  name: string
  description: string
  price: string
  tag: string
  tagClass: string
  icon: string
  iconClass: string
}

const products: Product[] = [
  {
    name: '学生平安综合险',
    description: '意外+医疗+重疾，全年守护',
    price: '¥200',
    tag: '热卖',
    tagClass: 'product-tag-hot',
    icon: '◆',
    iconClass: 'product-icon-blue'
  },
  {
    name: '少儿意外医疗险',
    description: '门诊住院报销，0免赔',
    price: '¥99',
    tag: '新品',
    tagClass: 'product-tag-new',
    icon: '▣',
    iconClass: 'product-icon-teal'
  },
  {
    name: '家庭综合保障计划',
    description: '全家共享，一份保单保多人',
    price: '¥399',
    tag: '热门',
    tagClass: 'product-tag-popular',
    icon: '♥',
    iconClass: 'product-icon-purple'
  }
]

const partners = [
  { name: '中国人保', sub: 'PICC', color: '#d53a32' },
  { name: '中国人寿', sub: 'CHINA LIFE', color: '#168d74' },
  { name: '太平洋保险', sub: 'CPIC', color: '#286bb2' },
  { name: '中国平安', sub: 'PING AN', color: '#e36d23' },
  { name: '中华保险', sub: 'CIC', color: '#c93240' },
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
        <View className='hero-banner'>
          <Image className='hero-banner-image' src={insuranceBanner} mode='aspectFill' />
          <View className='hero-pagination'>
            <View className='hero-dot hero-dot-active' />
            <View className='hero-dot' />
            <View className='hero-dot' />
          </View>
        </View>

        <View className='quick-entry-grid'>
          <View className='quick-entry' onClick={() => showDeveloping('订单/保单')}>
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
          <Text className='section-more' onClick={() => showDeveloping('全部产品')}>查看全部 ›</Text>
        </View>

        <View className='product-list'>
          {products.map((product) => (
            <View className='product-card' key={product.name} onClick={openProduct}>
              <View className={`product-icon ${product.iconClass}`}>
                <Text>{product.icon}</Text>
              </View>
              <View className='product-info'>
                <View className='product-name-row'>
                  <Text className='product-name'>{product.name}</Text>
                  <Text className={`product-tag ${product.tagClass}`}>{product.tag}</Text>
                </View>
                <Text className='product-description'>{product.description}</Text>
                <View className='product-price-row'>
                  <Text className='product-price'>{product.price}</Text>
                  <Text className='product-unit'>/年</Text>
                </View>
              </View>
              <View className='insure-button'>立即投保</View>
            </View>
          ))}
        </View>

        <View className='section-heading partner-heading'>
          <View>
            <Text className='section-title'>合作保险公司</Text>
            <Text className='section-subtitle'>与多家知名保险机构深度合作，保障更安心</Text>
          </View>
          <Text className='section-more' onClick={() => showDeveloping('合作机构')}>查看全部</Text>
        </View>

        <View className='partner-grid'>
          {partners.map((partner) => (
            <View className='partner-item' key={partner.name}>
              <Text className='partner-sub' style={{ color: partner.color }}>{partner.sub}</Text>
              <Text className='partner-name'>{partner.name}</Text>
            </View>
          ))}
        </View>

        <View className='home-slogan'>
          <View className='slogan-shield'>✓</View>
          <Text>安心保 · 安心保障每一家</Text>
        </View>
      </View>

      <BottomNavigation active='home' />
    </View>
  )
}
