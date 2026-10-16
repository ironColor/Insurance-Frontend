import { Button, Image, RichText, ScrollView, Swiper, SwiperItem, Text, Video, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'

import { useProductConfig } from '../../hooks/use-product'
import type { ProductDocument } from '../../services/product'
import { openProductDocument } from '../../services/product-document'
import { buildProductUrl } from '../../services/product-entry'

import './index.css'

export default function ProductIntroPage() {
  const { config, loading, error, reload, shareUser } = useProductConfig()
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [activeAgreement, setActiveAgreement] = useState<ProductDocument | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  useDidShow(() => setAgreementAccepted(false))
  useEffect(() => {
    setVideoFailed(false)
    setAgreementAccepted(false)
    setActiveAgreement(null)
  }, [config?.id])

  if (!config) {
    return (
      <View className='product-intro-state'>
        <Text className='product-intro-state-title'>{loading ? '正在加载产品信息…' : '产品信息加载失败'}</Text>
        {!loading && <Text>{error}</Text>}
        {!loading && <Button onClick={reload}>重新加载</Button>}
        {!loading && <Button onClick={() => Taro.reLaunch({ url: '/pages/home/index' })}>返回首页</Button>}
      </View>
    )
  }

  const pageConfig = config.intro
  const hasVideo = pageConfig.media.mode === 'video' && Boolean(pageConfig.media.videoUrl) && !videoFailed
  const images = pageConfig.media.images || []
  const hasImages = pageConfig.media.mode === 'images' && images.length > 0
  const canStart = pageConfig.agreements.length === 0 || agreementAccepted

  const callService = () => {
    const phoneNumber = config.servicePhone.replace(/[\s-]/g, '')
    if (!/^\+?\d{5,20}$/.test(phoneNumber)) {
      void Taro.showToast({ title: '暂未配置客服电话', icon: 'none' })
      return
    }
    void Taro.makePhoneCall({ phoneNumber })
  }

  const showAgreement = (agreement: ProductDocument) => {
    if (agreement.contentType === 'text') setActiveAgreement(agreement)
    else void openProductDocument(agreement).catch(() => Taro.showToast({ title: '协议打开失败，请重试', icon: 'none' }))
  }

  const startInsuring = () => {
    if (!canStart) return
    void Taro.navigateTo({ url: buildProductUrl('/pages/plan/index', config.id, shareUser) })
  }

  return (
    <View className='product-intro-page'>
      <View className='custom-navigation'>
        <View className='navigation-safe-area' />
        <View className='location-bar'>
          <View className='location-mark'><View className='location-dot' /></View>
          <Text className='location-name'>{pageConfig.location || config.title}</Text>
        </View>
      </View>

      <View className='page-content'>
        <View className='letter-card'>
          <Text className='letter-title'>{pageConfig.letterTitle || config.title}</Text>
          {pageConfig.letterContent && <RichText className='letter-content' nodes={pageConfig.letterContent} />}
        </View>

        <View className='media-card'>
          {hasVideo ? (
            <Video
              className='intro-video'
              src={pageConfig.media.videoUrl || ''}
              autoplay
              controls
              objectFit='cover'
              showFullscreenBtn
              showPlayBtn
              showCenterPlayBtn
              onError={() => setVideoFailed(true)}
            />
          ) : hasImages ? (
            <Swiper
              className='intro-swiper'
              circular
              autoplay
              interval={pageConfig.media.interval || 3000}
              indicatorDots
              indicatorColor='rgba(255, 255, 255, 0.45)'
              indicatorActiveColor='#ffffff'
            >
              {images.map((imageUrl, index) => (
                <SwiperItem key={`${imageUrl}-${index}`}>
                  <Image className='intro-image' src={imageUrl} mode='aspectFill' onClick={() => Taro.previewImage({ urls: images, current: imageUrl })} />
                </SwiperItem>
              ))}
            </Swiper>
          ) : (
            <View className='media-placeholder'>
              <Text className='media-placeholder-text'>{videoFailed ? '视频加载失败，请稍后重试' : '暂无产品介绍视频或图片'}</Text>
              {videoFailed && <Text className='media-retry' onClick={() => setVideoFailed(false)}>重新加载视频</Text>}
            </View>
          )}
        </View>

        {(config.servicePhone || pageConfig.serviceTime) && (
          <View className='service-card'>
            {config.servicePhone && <View className='service-row service-row-phone' onClick={callService}>
              <View className='service-icon-wrap'><Text className='service-icon service-icon-phone'>☎</Text></View>
              <View className='service-info'>
                <Text className='service-label'>客服电话</Text>
                <View className='service-value-row'>
                  <Text className='service-value service-phone'>{config.servicePhone}</Text>
                  <Text className='service-action'>· 点击可拨打</Text>
                </View>
              </View>
            </View>}
            {config.servicePhone && pageConfig.serviceTime && <View className='service-divider' />}
            {pageConfig.serviceTime && <View className='service-row'>
              <View className='service-icon-wrap'><Text className='service-icon'>◷</Text></View>
              <View className='service-info'>
                <Text className='service-label'>工作时间</Text>
                <Text className='service-value'>{pageConfig.serviceTime}</Text>
              </View>
            </View>}
          </View>
        )}

        {(pageConfig.documents || []).length > 0 && <View className='product-documents'>
          <Text className='product-documents-title'>产品资料</Text>
          {(pageConfig.documents || []).map((document) => (
            <View className='product-document-row' key={document.id} onClick={() => showAgreement(document)}>
              <Text>{document.title}</Text>
              <Text className='product-document-open'>查看 ›</Text>
            </View>
          ))}
        </View>}
      </View>

      <View className='fixed-action-bar'>
        {pageConfig.agreements.length > 0 && <View className='agreement-area'>
          <View className={`agreement-checkbox ${agreementAccepted ? 'agreement-checkbox-checked' : ''}`} onClick={() => setAgreementAccepted((value) => !value)}>
            {agreementAccepted && <Text className='agreement-checkmark'>✓</Text>}
          </View>
          <Text className='agreement-prefix'>我已阅读并同意</Text>
          <View className='agreement-links'>
            {pageConfig.agreements.map((agreement, index) => (
              <Text key={agreement.id} className='agreement-link' onClick={() => showAgreement(agreement)}>
                《{agreement.title}》{index < pageConfig.agreements.length - 1 ? '、' : ''}
              </Text>
            ))}
          </View>
        </View>}
        <Button className={`start-button ${canStart ? 'start-button-enabled' : ''}`} disabled={!canStart} onClick={startInsuring}>开始投保</Button>
        {pageConfig.companySlogan && <Text className='company-slogan'>{pageConfig.companySlogan}</Text>}
      </View>

      {activeAgreement && (
        <View className='agreement-modal-mask'>
          <View className='agreement-modal'>
            <View className='agreement-modal-header'>
              <Text className='agreement-modal-title'>{activeAgreement.title}</Text>
              <View className='agreement-modal-close' onClick={() => setActiveAgreement(null)}><Text>×</Text></View>
            </View>
            <ScrollView className='agreement-modal-content' scrollY>
              {activeAgreement.content.length > 0
                ? activeAgreement.content.map((html, index) => <RichText key={index} className='agreement-modal-text' nodes={html} />)
                : <Text className='agreement-modal-text'>协议正文暂未配置，请联系客服确认。</Text>}
            </ScrollView>
            <Button className='agreement-modal-button' onClick={() => setActiveAgreement(null)}>我知道了</Button>
          </View>
        </View>
      )}
    </View>
  )
}
