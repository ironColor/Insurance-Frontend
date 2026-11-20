import { Button, Image, ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'

import BottomNavigation from '../../components/bottom-navigation'
import LocationHeader from '../../components/location-header'
import fallbackBanner from '../../assets/images/home-insurance-banner.jpg'
import { fetchHomeData, fetchHomeProducts, homeProductId, HomeBanner, HomeProduct, InsuranceCompany, resolveMediaUrl } from '../../services/home'
import { buildProductUrl } from '../../services/product-entry'
import { hasAuthSession } from '../../services/session'

import './index.css'

const showDeveloping = (title: string) => {
  Taro.showToast({ title: `${title}功能建设中`, icon: 'none' })
}

export default function HomePage() {
  const [banners, setBanners] = useState<HomeBanner[]>([])
  const [companies, setCompanies] = useState<InsuranceCompany[]>([])
  const [homeError, setHomeError] = useState('')
  const [products, setProducts] = useState<HomeProduct[]>([])
  const [productError, setProductError] = useState('')
  const [productLoading, setProductLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const nextPage = useRef(1)
  const fetchingProducts = useRef(false)
  const generation = useRef(0)
  const goingToLogin = useRef(false)

  const canApply = (ticket: number) => {
    if (ticket !== generation.current || goingToLogin.current) return false
    if (hasAuthSession()) return true
    goingToLogin.current = true
    void Taro.reLaunch({ url: '/pages/login/index' })
    return false
  }

  const loadHome = async () => {
    const ticket = generation.current
    try {
      const data = await fetchHomeData()
      if (!canApply(ticket)) return
      setBanners(data.banners)
      setCompanies(data.companies)
      setHomeError('')
    } catch (error) {
      if (canApply(ticket)) setHomeError(error instanceof Error ? error.message : '首页加载失败')
    }
  }

  const loadProducts = async () => {
    if (fetchingProducts.current) return
    const ticket = generation.current
    const pageNum = nextPage.current
    fetchingProducts.current = true
    setProductLoading(true)
    setProductError('')
    try {
      const result = await fetchHomeProducts(pageNum)
      if (!canApply(ticket)) return
      setProducts(previous => {
        const byId = new Map((pageNum === 1 ? [] : previous).map(item => [item.productId, item]))
        result.rows.forEach(item => byId.set(item.productId, item))
        return Array.from(byId.values())
      })
      setHasMore(result.hasMore)
      nextPage.current = pageNum + 1
    } catch (error) {
      if (canApply(ticket)) setProductError(error instanceof Error ? error.message : '产品加载失败')
    } finally {
      if (ticket === generation.current) {
        fetchingProducts.current = false
        setProductLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchingProducts.current = false
    if (canApply(generation.current)) {
      void loadHome()
      void loadProducts()
    }
    return () => { generation.current++ }
  }, [])

  const openProduct = (value?: number | string) => {
    const productId = homeProductId(value)
    if (!productId) {
      Taro.showToast({ title: '产品信息暂未配置', icon: 'none' })
      return
    }
    void Taro.navigateTo({ url: buildProductUrl('/pages/index/index', productId) }).catch(() => {
      void Taro.showToast({ title: '产品页面暂时无法打开，请重试', icon: 'none' })
    })
  }

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
              <SwiperItem key={String(banner.bannerId ?? index)}>
                <Image className='hero-banner-image' src={resolveMediaUrl(banner.bannerUrl)} mode='aspectFill' onClick={() => openProduct(banner.productId)} />
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
              {product.logoUrl ? <Image className='product-icon' src={product.logoUrl} mode='aspectFill' />
                : <View className={`product-icon product-icon-${index % 3}`}><Text>✦</Text></View>}
              <View className='product-info'>
                <Text className='product-tag'>保障方案</Text>
                <Text className='product-name'>{product.productName || product.productTitle || '保险产品'}</Text>
                <Text className='product-description'>{product.productName && product.productTitle && product.productName !== product.productTitle ? product.productTitle : '了解保障内容与投保方案'}</Text>
              </View>
              <View className='insure-button'>查看 ›</View>
            </View>
          ))}
          {productError ? <View className='home-error'><Text>{productError}</Text><Text className='home-retry' onClick={() => void loadProducts()}>重新加载 ›</Text></View>
            : hasMore ? <Button className='home-products-more' disabled={productLoading} onClick={() => void loadProducts()}>{productLoading ? '正在加载…' : '加载更多产品'}</Button>
            : products.length === 0 && <View className='home-empty-card'><Text className='home-empty-title'>{productLoading ? '正在加载产品…' : '暂无推荐产品'}</Text>{!productLoading && <Text className='home-empty-copy'>可稍后再来看看</Text>}</View>}
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
