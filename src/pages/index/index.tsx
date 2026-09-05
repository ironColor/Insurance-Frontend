import { Button, Image, ScrollView, Swiper, SwiperItem, Text, Video, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

import './index.css'

type Agreement = {
  id: string
  name: string
  content: string
}

type IntroMedia =
  | {
      mode: 'video'
      videoUrl: string
      poster?: string
    }
  | {
      mode: 'images'
      images: string[]
      interval: number
    }

type ProductIntroConfig = {
  location: string
  letterTitle: string
  letterContent: string
  media: IntroMedia
  servicePhone: string
  serviceTime: string
  companySlogan: string
  agreements: Agreement[]
}

const AGREEMENT_STORAGE_KEY = 'insurance-product-intro-agreement'

// 后续接入「产品管理 - 介绍页配置」接口时，仅需替换这一份配置数据。
const pageConfig: ProductIntroConfig = {
  location: '河北省保定市竞秀区',
  letterTitle: '致学生家长的一封信',
  letterContent: '尊敬的学生家长：您好！',
  media: {
    mode: 'video',
    videoUrl: ''
  },
  servicePhone: '400-xxx-xxxx',
  serviceTime: '周一至周日 9:00 - 21:00',
  companySlogan: '诚安达保险公司为您的孩子提供安心保障',
  agreements: [
    {
      id: 'privacy',
      name: '隐私政策',
      content:
        '我们重视并保护您的个人信息。为了向您提供保险产品介绍、投保及客户服务，我们会在取得授权后，按照合法、正当、必要和诚信的原则处理相关信息。未经您的授权，我们不会向无关第三方提供您的个人信息。'
    },
    {
      id: 'service',
      name: '客户服务协议',
      content:
        '使用本服务前，请您认真阅读并理解本协议。您确认后，即表示同意按照页面提示提供真实、准确、完整的信息，并遵守保险产品投保流程及相关服务规则。具体协议内容以后台配置为准。'
    }
  ]
}

export default function ProductIntroPage() {
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [activeAgreement, setActiveAgreement] = useState<Agreement | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)

  const hasVideo = pageConfig.media.mode === 'video' && Boolean(pageConfig.media.videoUrl) && !videoFailed
  const hasImages = pageConfig.media.mode === 'images' && pageConfig.media.images.length > 0

  useEffect(() => {
    setAgreementAccepted(Boolean(Taro.getStorageSync(AGREEMENT_STORAGE_KEY)))
  }, [])

  const toggleAgreement = () => {
    const nextValue = !agreementAccepted
    setAgreementAccepted(nextValue)
    Taro.setStorageSync(AGREEMENT_STORAGE_KEY, nextValue)
  }

  const callService = () => {
    if (!/^\d[\d-]+\d$/.test(pageConfig.servicePhone)) {
      Taro.showToast({ title: '客服电话配置中', icon: 'none' })
      return
    }

    Taro.makePhoneCall({ phoneNumber: pageConfig.servicePhone.replace(/-/g, '') })
  }

  const startInsuring = () => {
    if (!agreementAccepted) return
    Taro.navigateTo({ url: '/pages/plan/index' })
  }

  return (
    <View className='product-intro-page'>
      <View className='custom-navigation'>
        <View className='navigation-safe-area' />
        <View className='location-bar'>
          <View className='location-mark'>
            <View className='location-dot' />
          </View>
          <Text className='location-name'>{pageConfig.location}</Text>
        </View>
      </View>

      <View className='page-content'>
        <View className='letter-card'>
          <View className='letter-decoration letter-decoration-left' />
          <View className='letter-decoration letter-decoration-right' />
          <Text className='letter-title'>{pageConfig.letterTitle}</Text>
          <Text className='letter-content'>{pageConfig.letterContent}</Text>
        </View>

        <View className='media-card'>
          {hasVideo && pageConfig.media.mode === 'video' ? (
            <Video
              className='intro-video'
              src={pageConfig.media.videoUrl}
              poster={pageConfig.media.poster}
              autoplay
              controls
              objectFit='cover'
              showFullscreenBtn
              showPlayBtn
              showCenterPlayBtn
              onError={() => setVideoFailed(true)}
            />
          ) : hasImages && pageConfig.media.mode === 'images' ? (
            <Swiper
              className='intro-swiper'
              circular
              autoplay
              interval={pageConfig.media.interval}
              indicatorDots
              indicatorColor='rgba(255, 255, 255, 0.45)'
              indicatorActiveColor='#ffffff'
            >
              {pageConfig.media.images.map((imageUrl) => (
                <SwiperItem key={imageUrl}>
                  <Image className='intro-image' src={imageUrl} mode='aspectFill' />
                </SwiperItem>
              ))}
            </Swiper>
          ) : (
            <View className='media-placeholder'>
              <View className='media-placeholder-shine' />
              <Text className='media-placeholder-text'>视频将在预览时播放</Text>
              <View className='fake-controls'>
                <View className='fake-progress'>
                  <View className='fake-progress-value' />
                </View>
                <View className='fake-control-row'>
                  <Text className='fake-play'>▶</Text>
                  <Text className='fake-time'>0:00 / 0:00</Text>
                  <View className='fake-control-spacer' />
                  <Text className='fake-control-icon'>⌕</Text>
                  <Text className='fake-control-icon'>⌗</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View className='service-card'>
          <View className='service-row service-row-phone' onClick={callService}>
            <View className='service-icon-wrap'>
              <Text className='service-icon service-icon-phone'>☎</Text>
            </View>
            <View className='service-info'>
              <Text className='service-label'>客服电话</Text>
              <View className='service-value-row'>
                <Text className='service-value service-phone'>{pageConfig.servicePhone}</Text>
                <Text className='service-action'>· 点击可拨打</Text>
              </View>
            </View>
          </View>

          <View className='service-divider' />

          <View className='service-row'>
            <View className='service-icon-wrap'>
              <Text className='service-icon'>◷</Text>
            </View>
            <View className='service-info'>
              <Text className='service-label'>工作时间</Text>
              <Text className='service-value'>{pageConfig.serviceTime}</Text>
            </View>
          </View>
        </View>

        <View className='agreement-area'>
          <View
            className={`agreement-checkbox ${agreementAccepted ? 'agreement-checkbox-checked' : ''}`}
            onClick={toggleAgreement}
          >
            {agreementAccepted && <Text className='agreement-checkmark'>✓</Text>}
          </View>
          <Text className='agreement-prefix'>我已阅读并同意</Text>
          <View className='agreement-links'>
            {pageConfig.agreements.map((agreement, index) => (
              <Text
                key={agreement.id}
                className='agreement-link'
                onClick={() => setActiveAgreement(agreement)}
              >
                《{agreement.name}》{index < pageConfig.agreements.length - 1 ? '、' : ''}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <View className='fixed-action-bar'>
        <Button
          className={`start-button ${agreementAccepted ? 'start-button-enabled' : ''}`}
          disabled={!agreementAccepted}
          onClick={startInsuring}
        >
          开始投保
        </Button>
        <Text className='company-slogan'>{pageConfig.companySlogan}</Text>
      </View>

      {activeAgreement && (
        <View className='agreement-modal-mask'>
          <View className='agreement-modal'>
            <View className='agreement-modal-header'>
              <Text className='agreement-modal-title'>{activeAgreement.name}</Text>
              <View className='agreement-modal-close' onClick={() => setActiveAgreement(null)}>
                <Text>×</Text>
              </View>
            </View>
            <ScrollView className='agreement-modal-content' scrollY>
              <Text className='agreement-modal-text'>{activeAgreement.content}</Text>
            </ScrollView>
            <Button className='agreement-modal-button' onClick={() => setActiveAgreement(null)}>
              我知道了
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
