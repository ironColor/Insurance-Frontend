import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import Taro from '@tarojs/taro'
import * as home from '../src/services/home'
import * as product from '../src/services/product'
import * as entry from '../src/services/product-entry'
import * as session from '../src/services/session'
import { loadSourceModule } from './source-module'

const bannerId = '9223372036854775806'
const listId = '123'
const base = 'https://www.zfxbaoxian.com/prod-api/wxmini'
type Request = { url: string; method: string; data?: { pageNum?: number }; header: Record<string, string> }
const ok = (value: unknown) => ({ statusCode: 200, data: JSON.stringify(value) })
const navigations: string[] = []
const notices: string[] = []
const settle = () => new Promise(resolve => setImmediate(resolve))
beforeEach(() => {
  const storage = new Map()
  navigations.length = notices.length = 0
  Object.assign(Taro, {
    getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, value), removeStorageSync: (key: string) => storage.delete(key),
    navigateTo: async ({ url }: { url: string }) => { navigations.push(url) },
    showToast: async ({ title }: { title: string }) => { notices.push(title) }
  })
  session.saveAuthSession({ token: 'local-test', headerName: 'Wx-Authorization' })
})

test('热门产品读取顶层分页、携带登录头并保留长 ID；忽略禁用/无 ID 的行', async () => {
  Object.assign(Taro, { request: async (req: Request) => {
    assert.equal(req.url, `${base}/home/productList`)
    assert.equal(req.method, 'GET')
    assert.deepEqual(req.data, { pageNum: 2, pageSize: 10, status: '0' })
    assert.equal(req.header['Wx-Authorization'], 'Bearer local-test')
    return { statusCode: 200, data: `{"code":200,"total":13,"rows":[{"productId":${bannerId},"productName":"示例产品","logoUrl":"/test.jpg"},{"productId":2,"status":"1"},{}]}` }
  } })
  const page = await home.fetchHomeProducts(2)
  assert.deepEqual(page, { rows: [{ productId: bannerId, productName: '示例产品', productTitle: '', logoUrl: 'https://www.zfxbaoxian.com/test.jpg' }], hasMore: false })
  Object.assign(Taro, { request: async () => ok({ code: 200, data: [] }) })
  await assert.rejects(home.fetchHomeProducts(), /格式异常/)
  Object.assign(Taro, { request: async () => ok({ code: 200, total: 0, rows: [] }) })
  assert.deepEqual(await home.fetchHomeProducts(), { rows: [], hasMore: false })
})

// Exercise the actual home tap handlers and destination hook with simulated platform requests.
function hooks() {
  const slots: any[] = []; let cursor = 0; let mounted = false; let effects: (() => void)[] = []
  const react = {
    useState(initial: unknown) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (next: any) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef(initial: unknown) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i] },
    useEffect(fn: () => void) { if (!mounted) effects.push(fn) }
  }
  return { react, render<T>(fn: () => T): T { cursor = 0; effects = []; const result = fn(); mounted = true; effects.forEach(effect => effect()); return result } }
}
type Element = { type: string; props: { children?: unknown; className?: string; onClick?: () => void } }
function findAll(node: unknown, className: string): Element[] {
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, className))
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as Element
  return [...(element.props.className === className ? [element] : []), ...findAll(element.props.children, className)]
}
function homePage() {
  const h = hooks()
  const jsx = (type: string, props: Element['props']) => ({ type, props })
  const page = loadSourceModule<{ default(): Element }>('src/pages/home/index.tsx', {
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@tarojs/taro': Taro,
    '@tarojs/components': { Button: 'Button', Image: 'Image', ScrollView: 'ScrollView', Swiper: 'Swiper', SwiperItem: 'SwiperItem', Text: 'Text', View: 'View' },
    '../../components/bottom-navigation': 'BottomNavigation', '../../components/location-header': 'LocationHeader', '../../assets/images/home-insurance-banner.jpg': 'fallback.jpg',
    '../../services/home': home, '../../services/session': session, '../../services/product-entry': entry, './index.css': {}
  })
  return () => h.render(page.default)
}
function homepageResponse(req: Request) {
  if (req.url === `${base}/home/bannerList`) return { statusCode: 200, data: `{"code":200,"data":[{"bannerId":1,"productId":${bannerId},"linkUrl":"https://example.com/"},{"bannerId":2}]}` }
  if (req.url === `${base}/home/companyList`) return ok({ code: 200, data: [] })
  throw Error('意外的测试请求: ' + req.url)
}
test('卡片使用 productList，点击独立 Banner 按其绑定 ID 加载介绍页；没有关联时不跳转', async () => {
  let detailReads = 0
  Object.assign(Taro, { request: async (req: Request) => {
    if (req.url === `${base}/home/productList`) return ok({ code: 200, rows: [{ productId: listId, productName: '列表专属产品' }], total: 1 })
    if (req.url === `${base}/product/allInfo/${bannerId}`) {
      detailReads++
      return ok({ code: 200, data: { productId: bannerId, productName: '横幅专属产品', status: '0', planGroupList: [{ groupId: '1', planList: [{ planId: '2', price: 10 }] }] } })
    }
    return homepageResponse(req)
  } })
  const render = homePage(); render(); await settle(); const tree = render()
  const cards = findAll(tree, 'product-card'); assert.equal(cards.length, 1)
  cards[0].props.onClick!()
  const banners = findAll(tree, 'hero-banner-image'); banners[0].props.onClick!(); banners[1].props.onClick!()
  assert.deepEqual(navigations, [`/pages/index/index?productId=${listId}`, `/pages/index/index?productId=${bannerId}`])
  assert.deepEqual(notices, ['该产品暂不可用，请选择其他产品'])
  const target = new URL(navigations[1], 'https://local.invalid')
  const h = hooks()
  const { useProductConfig } = loadSourceModule<typeof import('../src/hooks/use-product')>('src/hooks/use-product.ts', {
    react: h.react, '@tarojs/taro': { ...Taro, useRouter: () => ({ path: target.pathname, params: Object.fromEntries(target.searchParams) }) },
    '../services/product': product, '../services/product-entry': entry, '../services/session': session
  })
  h.render(useProductConfig); await settle()
  assert.equal(h.render(useProductConfig).config?.title, '横幅专属产品'); assert.equal(detailReads, 1)
})
test('热门产品失败时 Banner 仍能点击；重试和加载更多保留服务端分页顺序', async () => {
  const pages: number[] = []
  Object.assign(Taro, { request: async (req: Request) => {
    if (req.url !== `${base}/home/productList`) return homepageResponse(req)
    pages.push(req.data!.pageNum!)
    if (pages.length === 1) return ok({ code: 500, msg: '测试服务繁忙' })
    const rows = req.data!.pageNum === 1 ? Array.from({ length: 10 }, (_, i) => ({ productId: i + 1 })) : [{ productId: 10 }, { productId: 11 }]
    return ok({ code: 200, rows, total: 12 })
  } })
  const render = homePage(); render(); await settle(); let tree = render()
  assert.equal(findAll(tree, 'product-card').length, 0)
  findAll(tree, 'hero-banner-image')[0].props.onClick!(); assert.deepEqual(navigations, [`/pages/index/index?productId=${bannerId}`])
  findAll(tree, 'home-retry')[0].props.onClick!(); await settle(); tree = render()
  const more = findAll(tree, 'home-products-more')[0]; more.props.onClick!(); more.props.onClick!(); await settle(); tree = render()
  assert.deepEqual(pages, [1, 1, 2]); const cards = findAll(tree, 'product-card'); assert.equal(cards.length, 11)
  cards[10].props.onClick!(); assert.equal(navigations[1], '/pages/index/index?productId=11')
  assert.equal(findAll(tree, 'home-products-more').length, 0)
})
