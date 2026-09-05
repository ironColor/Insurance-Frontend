import { Button, Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'

import brandMarks from '../../assets/images/brand-marks.png'
import { requestWechatAuthorization } from '../../services/auth'

import './index.css'

export default function LoginPage() {
  const [authorizationVisible, setAuthorizationVisible] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)

  const showAuthorization = () => {
    if (!loggingIn) setAuthorizationVisible(true)
  }

  const rejectAuthorization = () => {
    if (loggingIn) return

    setAuthorizationVisible(false)
    Taro.showToast({ title: '已拒绝授权', icon: 'none' })
  }

  const showAgreement = (type: 'service' | 'privacy') => {
    const isPrivacy = type === 'privacy'

    Taro.showModal({
      title: isPrivacy ? '隐私政策' : '用户协议',
      content: isPrivacy
        ? '我们仅在提供登录、实名认证及保险服务所必需的范围内处理你的个人信息，具体内容以后端正式协议为准。'
        : '登录并使用本服务前，请确认你已阅读并同意服务规则。正式协议内容接入后端配置后展示。',
      showCancel: false,
      confirmText: '我知道了'
    })
  }

  const handleAuthorization = async (event: {
    detail: {
      errMsg: string
      code?: string
      encryptedData?: string
      iv?: string
    }
  }) => {
    if (loggingIn) return

    const { errMsg, code, encryptedData, iv } = event.detail

    if (!errMsg.includes(':ok') || (!code && !encryptedData)) {
      setAuthorizationVisible(false)
      Taro.showToast({ title: '已拒绝授权', icon: 'none' })
      return
    }

    setLoggingIn(true)

    try {
      await requestWechatAuthorization({ code, encryptedData, iv })

      // 接入后端登录接口时，在 auth service 中用登录 code 和手机号 code 换取业务 token。

      await Taro.showToast({
        title: '微信授权成功',
        icon: 'success',
        duration: 900
      })

      setAuthorizationVisible(false)

      setTimeout(() => {
        Taro.reLaunch({ url: '/pages/home/index' })
      }, 600)
    } catch (error) {
      console.error('微信登录失败', error)
      Taro.showToast({
        title: '登录失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <View className='login-page'>
      <View className='login-safe-area' />

      <View className='login-content'>
        <View className='brand-block'>
          <View className='brand-logo-viewport'>
            <Image className='brand-logo-source' src={brandMarks} mode='widthFix' />
          </View>
          <Text className='brand-name'>正方形保险</Text>
        </View>

        <Button
          className={`wechat-login-button ${loggingIn ? 'wechat-login-button-loading' : ''}`}
          disabled={loggingIn}
          hoverClass='wechat-login-button-hover'
          onClick={showAuthorization}
        >
          {!loggingIn && (
            <View className='wechat-logo' aria-hidden>
              <View className='wechat-bubble wechat-bubble-large'>
                <View className='wechat-eye wechat-eye-left' />
                <View className='wechat-eye wechat-eye-right' />
              </View>
              <View className='wechat-bubble wechat-bubble-small'>
                <View className='wechat-eye wechat-eye-left' />
                <View className='wechat-eye wechat-eye-right' />
              </View>
            </View>
          )}
          <Text className='wechat-login-text'>{loggingIn ? '登录中…' : '微信一键登录'}</Text>
        </Button>

        <Text className='login-tip'>手机号验证通过后将自动创建账号</Text>
      </View>

      {authorizationVisible && (
        <View className='authorization-overlay' catchMove onClick={rejectAuthorization}>
          <View className='authorization-dialog' onClick={(event) => event.stopPropagation()}>
            <View className='authorization-header'>
              <View className='authorization-app-icon'>学</View>
              <View className='authorization-heading'>
                <Text className='authorization-app-name'>学平保</Text>
                <Text className='authorization-title'>申请获取以下权限</Text>
              </View>
              <Text className='authorization-close' onClick={rejectAuthorization}>×</Text>
            </View>

            <View className='authorization-divider' />

            <View className='permission-list'>
              <View className='permission-item'>
                <View className='permission-icon permission-icon-avatar'>像</View>
                <View className='permission-copy'>
                  <Text className='permission-name'>微信头像</Text>
                  <Text className='permission-description'>用于完善个人资料</Text>
                </View>
              </View>

              <View className='permission-item'>
                <View className='permission-icon permission-icon-nickname'>称</View>
                <View className='permission-copy'>
                  <Text className='permission-name'>微信昵称</Text>
                  <Text className='permission-description'>用于展示用户信息</Text>
                </View>
              </View>

              <View className='permission-item'>
                <View className='permission-icon permission-icon-phone'>号</View>
                <View className='permission-copy'>
                  <Text className='permission-name'>手机号码</Text>
                  <Text className='permission-description'>用于账号登录与实名认证</Text>
                </View>
              </View>
            </View>

            <View className='authorization-agreement'>
              <Text>登录即表示你已阅读并同意</Text>
              <Text className='agreement-link' onClick={() => showAgreement('service')}>《用户协议》</Text>
              <Text>和</Text>
              <Text className='agreement-link' onClick={() => showAgreement('privacy')}>《隐私政策》</Text>
            </View>

            <Button
              className='authorization-allow-button'
              disabled={loggingIn}
              loading={loggingIn}
              openType='getPhoneNumber'
              hoverClass='authorization-allow-button-hover'
              onGetPhoneNumber={handleAuthorization}
            >
              {loggingIn ? '授权中…' : '允许'}
            </Button>

            <Button
              className='authorization-reject-button'
              disabled={loggingIn}
              hoverClass='authorization-reject-button-hover'
              onClick={rejectAuthorization}
            >
              拒绝
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
