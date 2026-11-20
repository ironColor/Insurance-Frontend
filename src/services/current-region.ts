import Taro from '@tarojs/taro'

type RegionResponse = {
  status?: number
  result?: { address_component?: { province?: string; city?: string; district?: string } }
}

/** 只解析微信授权后的模糊坐标。不缓存坐标，不携带保险业务的登录头。 */
export async function getCurrentRegion(publicKey: string | undefined, isActive: () => boolean): Promise<string | null> {
  if (!publicKey?.trim() || !isActive() || typeof Taro.getFuzzyLocation !== 'function') return null
  try {
    const { latitude, longitude } = await Taro.getFuzzyLocation({ type: 'gcj02' })
    if (!isActive() || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null
    const { statusCode, data } = await Taro.request<RegionResponse>({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      method: 'GET',
      data: { key: publicKey, location: `${latitude},${longitude}`, get_poi: 0 },
      timeout: 8000
    })
    if (!isActive() || statusCode !== 200 || data?.status !== 0) return null
    const area = data.result?.address_component
    const parts = [area?.province, area?.city, area?.district]
      .map(part => typeof part === 'string' ? part.trim() : '')
      .filter(Boolean)
    // 直辖市的省、市名称相同；省直辖县级市的市、区名称也可能重复。
    return [...new Set(parts)].join('') || null
  } catch {
    // 拒绝授权、未开通能力或地址解析失败都不影响投保。
    return null
  }
}
