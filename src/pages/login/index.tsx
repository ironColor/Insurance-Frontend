import { Button, Checkbox, CheckboxGroup, Image, Label, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'

import loginLogo from '../../assets/images/login-logo.jpg'
import { loginWithWechat } from '../../services/auth'
import { cachePhone, clearUserProfile, fetchUserProfile } from '../../services/profile'
import { getLoginDestination } from '../../services/product-entry'
import { hasAuthSession } from '../../services/session'

import './index.css'

export default function LoginPage() {
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const loginPending = useRef(false)
  const pageActive = useRef(true)
  const loginSequence = useRef(0)

  useEffect(() => {
    pageActive.current = true
    if (hasAuthSession()) {
      Taro.reLaunch({ url: getLoginDestination() })
    }
    return () => {
      pageActive.current = false
      loginSequence.current += 1
    }
  }, [])

  const remindAgreement = () => {
    Taro.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' })
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
    }
  }) => {
    if (!pageActive.current || loginPending.current) return
    if (!agreementAccepted) {
      remindAgreement()
      return
    }

    const { errMsg, code } = event.detail

    if (errMsg !== 'getPhoneNumber:ok' || !code) {
      const cancelled = /deny|cancel/i.test(errMsg)
      Taro.showToast({
        title: cancelled ? '已取消手机号授权' : '手机号授权失败，请重试',
        icon: 'none'
      })
      return
    }

    loginPending.current = true
    setLoggingIn(true)
    const run = ++loginSequence.current
    const isActiveRun = () => pageActive.current && loginSequence.current === run

    try {
      const result = await loginWithWechat(code)
      if (!isActiveRun()) return
      clearUserProfile()
      cachePhone(result.phone, result.userId)
      if (result.userId) {
        try {
          await fetchUserProfile(isActiveRun)
          if (!isActiveRun()) return
        } catch (error) {
          if (!isActiveRun()) return
          console.error('获取用户资料失败', error)
        }
      }

      await Taro.showToast({
        title: '微信授权成功',
        icon: 'success',
        duration: 900
      })
      if (!isActiveRun()) return

      Taro.reLaunch({ url: getLoginDestination() })
    } catch (error) {
      if (!isActiveRun()) return
      console.error('微信登录失败', error)
      Taro.showToast({
        title: error instanceof Error ? error.message : '登录失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      if (isActiveRun()) {
        loginPending.current = false
        setLoggingIn(false)
      }
    }
  }

  return (
    <View className='login-page'>
      <View className='login-content'>
        <View className='brand-block'>
          <Image className='brand-logo' src={loginLogo} mode='aspectFill' />
          <Text className='login-headline'>登录正方形平台</Text>
          <View className='login-description'>
            <Text>使用微信账号快捷登录</Text>
            <Text>无需输入账号密码</Text>
          </View>
        </View>

        <Button
          className='wechat-login-button'
          disabled={loggingIn}
          loading={loggingIn}
          openType={agreementAccepted && !loggingIn ? 'getPhoneNumber' : undefined}
          hoverClass='wechat-login-button-hover'
          onClick={() => {
            if (!loginPending.current && !agreementAccepted) remindAgreement()
          }}
          onGetPhoneNumber={handleAuthorization}
        >
          {loggingIn ? '登录中…' : '手机号一键登录'}
        </Button>
      </View>

      <CheckboxGroup
        className='login-agreement'
        onChange={(event) => {
          if (!loginPending.current) setAgreementAccepted(event.detail.value.includes('agreement'))
        }}
      >
        <Label className='login-agreement-checkbox-label'>
          <Checkbox
            className='login-agreement-checkbox'
            value='agreement'
            checked={agreementAccepted}
            disabled={loggingIn}
            color='#3b7bf5'
            ariaLabel='已阅读并同意用户协议和隐私政策'
          />
        </Label>
        <View className='login-agreement-copy'>
          <Text>已阅读并同意</Text>
          <Text className='agreement-link' onClick={() => showAgreement('service')}>《用户协议》</Text>
          <Text>和</Text>
          <Text className='agreement-link' onClick={() => showAgreement('privacy')}>《隐私政策》</Text>
        </View>
      </CheckboxGroup>
    </View>
  )
}
