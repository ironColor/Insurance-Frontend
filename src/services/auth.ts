import Taro from '@tarojs/taro'

export type WechatLoginCredential = {
  code: string
}

export type WechatPhoneCredential = {
  code?: string
  encryptedData?: string
  iv?: string
}

export type WechatAuthorizationCredential = {
  loginCode: string
  phone: WechatPhoneCredential
}

/**
 * 获取微信临时登录凭证。
 * 后续拿到后端接口契约后，应在这里用 code 换取业务 token。
 */
export async function requestWechatLoginCredential(): Promise<WechatLoginCredential> {
  const result = await Taro.login({ timeout: 10000 })

  if (!result.code) {
    throw new Error('未获取到微信登录凭证')
  }

  return { code: result.code }
}

/**
 * 汇总后端完成微信登录所需的前端凭证。
 * phone.code 为新版手机号动态令牌；encryptedData/iv 用于兼容旧版基础库。
 */
export async function requestWechatAuthorization(
  phone: WechatPhoneCredential
): Promise<WechatAuthorizationCredential> {
  const loginCredential = await requestWechatLoginCredential()

  return {
    loginCode: loginCredential.code,
    phone
  }
}
