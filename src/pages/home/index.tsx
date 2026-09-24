import { Image, ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

import BottomNavigation from '../../components/bottom-navigation'
import LocationHeader from '../../components/location-header'
import fallbackBanner from '../../assets/images/home-insurance-banner.jpg'
import { fetchHomeData, HomeBanner, InsuranceCompany, resolveMediaUrl } from '../../services/home'
import { hasAuthSession } from '../../services/session'

import './index.css'

const showDeveloping = (title: string) => {
  Taro.showToast({ title: `${title}功能建设中`, icon: 'none' })
}

export default function HomePage() {
  const [banners, setBanners] = useState<HomeBanner[]>([])
  const [companies, setCompanies] = useState<InsuranceCompany[]>([])
  const [homeError, setHomeError] = useState('')

  const loadHome = async () => {
    try {
      const data = await fetchHomeData()
      setBanners(data.banners)
      setCompanies(data.companies)
      setHomeError('')
    } catch (error) {
      if (!hasAuthSession()) {
        Taro.reLaunch({ url: '/pages/login/index' })
        return
      }
      setHomeError(error instanceof Error ? error.message : '首页加载失败')
    }
  }

  useEffect(() => {
    if (!hasAuthSession()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    void loadHome()
  }, [])

  const openProduct = (productId?: number | string) => {
    if (!productId) {
      Taro.showToast({ title: '产品信息暂未配置', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/index/index?productId=${encodeURIComponent(String(productId))}` })
  }

  const products = banners.filter((banner, index, list) => banner.productId && list.findIndex((item) => item.productId === banner.productId) === index)

  return (
    <View className='home-page'>
      <LocationHeader />

      <View className='home-content'>
        <View className='home-intro'>
          <View>
            <Text className='home-intro-kicker'>正方形保险 · 安心服务</Text>
            <Text className='home-intro-title'>为每一份成长，添一份保障</Text>
          </View>
          <View className='home-intro-mark'>保</View>
        </View>
        {banners.length > 0 ? (
          <Swiper className='hero-banner' circular autoplay indicatorDots>
            {banners.map((banner, index) => (
              <SwiperItem key={String(banner.bannerId || index)} onClick={() => openProduct(banner.productId)}>
                <Image className='hero-banner-image' src={resolveMediaUrl(banner.bannerUrl)} mode='aspectFill' />
              </SwiperItem>
            ))}
          </Swiper>
        ) : <View className='hero-banner hero-banner-fallback'><Image className='hero-banner-image' src={fallbackBanner} mode='aspectFill' /></View>}
        {homeError && <View className='home-error'><Text>{homeError}</Text><Text className='home-retry' onClick={() => void loadHome()}>重新加载 ›</Text></View>}

        <View className='home-section-label'><Text>常用服务</Text><Text className='home-section-caption'>所需服务，快速直达</Text></View>
        <View className='quick-entry-grid'>
          <View className='quick-entry' onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
            <View className='quick-entry-icon quick-entry-blue'>
              <Text className='quick-entry-symbol'>▤</Text>
            </View>
            <Text className='quick-entry-name'>订单保单</Text>
          </View>
          <View className='quick-entry' onClick={() => showDeveloping('理赔报案')}>
            <View className='quick-entry-icon quick-entry-teal'>
              <Text className='quick-entry-symbol'>＋</Text>
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

        <View className='section-heading'>
          <View>
            <Text className='section-kicker'>精选保障</Text>
            <Text className='section-title'>热门产品</Text>
          </View>
          {products.length > 0 && <Text className='section-more' onClick={() => openProduct(products[0].productId)}>查看方案  ›</Text>}
        </View>

        <View className='product-list'>
          {products.map((product, index) => (
            <View className='product-card' key={String(product.productId)} onClick={() => openProduct(product.productId)}>
              <View className={`product-icon product-icon-${index % 3}`}><Text>✦</Text></View>
              <View className='product-info'>
                <Text className='product-tag'>保障方案</Text>
                <Text className='product-name'>{product.productName || '保险产品'}</Text>
                <Text className='product-description'>了解保障内容与投保方案</Text>
              </View>
              <View className='insure-button'>查看 ›</View>
            </View>
          ))}
          {products.length === 0 && <View className='home-empty-card'><Text className='home-empty-title'>暂无推荐产品</Text><Text className='home-empty-copy'>可稍后再来看看</Text></View>}
        </View>

        <View className='section-heading partner-heading'>
          <View>
            <Text className='section-kicker'>值得信赖</Text>
            <Text className='section-title'>合作保险公司</Text>
            <Text className='section-subtitle'>与多家知名保险机构深度合作，保障更安心</Text>
          </View>
        </View>

        <ScrollView className='partner-scroll' scrollX>
          <View className='partner-grid'>
            {companies.map((company, index) => (
              <View className='partner-item' key={String(company.insCompanyId || index)}>
                {company.logoUrl ? <Image className='partner-logo' src={resolveMediaUrl(company.logoUrl)} mode='aspectFit' /> : null}
                <Text className='partner-name'>{company.companyNickName || company.companyName || '保险公司'}</Text>
              </View>
            ))}
            {companies.length === 0 && <Text className='home-empty'>暂无合作机构信息</Text>}
          </View>
        </ScrollView>

        <View className='home-slogan'>
          <View className='slogan-shield'>✓</View>
          <Text>正方形保险 · 用心守护每一家</Text>
        </View>
      </View>

      <BottomNavigation active='home' />
    </View>
  )
}
