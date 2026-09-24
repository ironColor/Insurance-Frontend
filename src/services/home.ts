import { apiRequest } from './api'

export type HomeBanner = {
  bannerId?: number | string
  bannerUrl?: string
  linkUrl?: string
  productId?: number | string
  productName?: string
  sort?: number
  status?: string
}

export type InsuranceCompany = {
  insCompanyId?: number | string
  companyName?: string
  companyNickName?: string
  companyEngName?: string
  logoUrl?: string
  sort?: number
  status?: string
}

export function resolveMediaUrl(url?: string): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  return `https://www.zfxbaoxian.com/${url.replace(/^\//, '')}`
}

export async function fetchHomeData(): Promise<{ banners: HomeBanner[]; companies: InsuranceCompany[] }> {
  const [banners, companies] = await Promise.all([
    apiRequest<HomeBanner[]>('/home/bannerList', 'GET'),
    apiRequest<InsuranceCompany[]>('/home/companyList', 'GET')
  ])
  return {
    banners: (banners || []).filter((item) => item.status !== '1').sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0)),
    companies: (companies || []).filter((item) => item.status !== '1').sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
  }
}
