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

export type HomeProduct = {
  productId: string
  productName: string
  productTitle: string
  logoUrl: string
}

/** 首页两个入口均使用接口的 int64 主键；不要把字符串长 ID 转为 Number。 */
export function homeProductId(value: unknown): string | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : undefined
  if (typeof value !== 'string') return undefined
  const id = value.trim()
  return /^[1-9]\d*$/.test(id) ? id : undefined
}

const HOME_PRODUCT_PAGE_SIZE = 10

export async function fetchHomeProducts(pageNum = 1): Promise<{ rows: HomeProduct[]; hasMore: boolean }> {
  const page = await apiRequest<{ rows?: unknown; total?: number | string }>('/home/productList', 'GET', {
    pageNum, pageSize: HOME_PRODUCT_PAGE_SIZE, status: '0'
  }, 'raw')
  const total = typeof page?.total === 'string' && /^\d+$/.test(page.total) ? Number(page.total) : page?.total
  if (!Array.isArray(page?.rows) || typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
    throw new Error('产品列表返回格式异常，请重试')
  }
  const rows: HomeProduct[] = []
  for (const item of page.rows) {
    if (!item || String(item.status) === '1') continue
    const productId = homeProductId(item.productId)
    if (productId) rows.push({
      productId,
      productName: typeof item.productName === 'string' ? item.productName.trim() : '',
      productTitle: typeof item.productTitle === 'string' ? item.productTitle.trim() : '',
      logoUrl: typeof item.logoUrl === 'string' ? resolveMediaUrl(item.logoUrl.trim()) : ''
    })
  }
  return { rows, hasMore: page.rows.length > 0 && pageNum * HOME_PRODUCT_PAGE_SIZE < total }
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
