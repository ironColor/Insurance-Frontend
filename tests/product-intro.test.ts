import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { loadSourceModule } from './source-module'
import type { ProductDocument } from '../src/services/product-types'

function introPage(agreements: ProductDocument[]) {
  const defaults = loadSourceModule<typeof import('../src/services/default-product-agreements')>('src/services/default-product-agreements.ts', {
    '../assets/agreements/user-service.html?raw': readFileSync('src/assets/agreements/user-service.html', 'utf8'),
    '../assets/agreements/privacy-policy.html?raw': readFileSync('src/assets/agreements/privacy-policy.html', 'utf8')
  })
  const slots: unknown[] = []; let cursor = 0; let mounted = false; let onShow = () => {}; const effects: (() => void)[] = []
  const calls: string[] = []
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props })
  const config = { id: 'P', title: '测试产品', intro: { location: '部门不作为定位', media: { mode: 'images' }, agreements } }
  const { default: Page } = loadSourceModule<{ default(): any }>('src/pages/index/index.tsx', {
    react: {
      useState(value: unknown) { const idx = cursor++; if (!(idx in slots)) slots[idx] = value; return [slots[idx], (next: any) => { slots[idx] = typeof next === 'function' ? next(slots[idx]) : next }] },
      useEffect(fn: () => void) { if (!mounted) effects.push(fn) }
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@tarojs/taro': { useDidShow(fn: () => void) { onShow = fn }, navigateTo: async ({ url }: { url: string }) => { calls.push(url) } },
    '@tarojs/components': Object.fromEntries('Button Image RichText ScrollView Swiper SwiperItem Text Video View'.split(' ').map(name => [name, name])),
    '../../hooks/use-product': { useProductConfig: () => ({ config }) },
    '../../components/current-region': 'CurrentRegion',
    '../../services/default-product-agreements': defaults, '../../services/product-document': {}, '../../services/product-entry': { buildProductUrl: () => '/plan' }, './index.css': {}
  })
  const find = (name: string): any[] => {
    cursor = 0; const tree = Page(); mounted = true; effects.splice(0).forEach(effect => effect())
    function walk(node: any): any[] {
      if (Array.isArray(node)) return node.flatMap(walk)
      if (!node?.props) return []
      return [...(node.props.className?.split(' ').includes(name) ? [node.props] : []), ...walk(node.props.children)]
    }
    return walk(tree)
  }
  return { find, calls, onShow: () => onShow(), defaults: defaults.defaultProductAgreements }
}

test('无后台协议：展示两份附件，可独立读全文，只有手动勾选可投保，返回后重置', () => {
  const page = introPage([])
  assert.deepEqual(page.find('agreement-link').map(p => p.children[1]), ['用户服务协议', '隐私政策'])
  for (const [i, agreement] of page.defaults.entries()) {
    page.find('agreement-link')[i].onClick()
    assert.equal(page.find('agreement-modal-title')[0].children, agreement.title)
    assert.equal(page.find('agreement-modal-text')[0].nodes, agreement.content[0])
    page.find('agreement-modal-button')[0].onClick()
    const start = page.find('start-button')[0]; assert.equal(start.disabled, true); start.onClick()
    assert.deepEqual(page.calls, [])
  }
  page.find('agreement-checkbox')[0].onClick(); assert.equal(page.find('start-button')[0].disabled, false)
  page.find('start-button')[0].onClick(); assert.deepEqual(page.calls, ['/plan'])
  page.onShow(); assert.equal(page.find('start-button')[0].disabled, true)
})

test('已有后台协议：不混入默认协议，取消勾选立即恢复禁用', () => {
  const page = introPage([{ id: 'custom', title: '产品专属协议', contentType: 'text', content: ['<p>专属条款测试</p>'] }])
  assert.deepEqual(page.find('agreement-link').map(p => p.children[1]), ['产品专属协议'])
  page.find('agreement-link')[0].onClick(); assert.equal(page.find('agreement-modal-text')[0].nodes, '<p>专属条款测试</p>')
  page.find('agreement-modal-close')[0].onClick(); assert.equal(page.find('start-button')[0].disabled, true)
  page.find('agreement-checkbox')[0].onClick(); page.find('agreement-checkbox')[0].onClick()
  assert.equal(page.find('start-button')[0].disabled, true)
})

const locateWith = (platform: Record<string, unknown>) =>
  loadSourceModule<typeof import('../src/services/current-region')>('src/services/current-region.ts', { '@tarojs/taro': platform }).getCurrentRegion

test('定位：仅把授权的模糊坐标交给地址解析，只返回省市区，直辖市不重复', async () => {
  const getCurrentRegion = locateWith({
    getFuzzyLocation: async ({ type }: { type: string }) => { assert.equal(type, 'gcj02'); return { latitude: 40, longitude: 116 } },
    request: async (options: { url: string; data: { key: string; location: string; get_poi: number }; header?: unknown }) => {
      assert.equal(options.url, 'https://apis.map.qq.com/ws/geocoder/v1/')
      assert.deepEqual({ ...options.data }, { key: 'mock-key', location: '40,116', get_poi: 0 })
      assert.equal(options.header, undefined)
      return { statusCode: 200, data: { status: 0, result: { address_component: { province: '北京市', city: '北京市', district: '海淀区', street: '不应展示' } } } }
    }
  })
  assert.equal(await getCurrentRegion('mock-key', () => true), '北京市海淀区')
})

test('定位：未配置不弹授权；拒绝、卸载或坐标无效不外发，解析失败返回未定位', async () => {
  const active = () => true
  let asked = 0; let sent = 0
  const fuzzy = async () => { asked++; return { latitude: 40, longitude: 116 } }
  const request = async () => { sent++; return { statusCode: 200, data: { status: 110 } } }
  assert.equal(await locateWith({ getFuzzyLocation: fuzzy, request })('', active), null)
  assert.equal(asked, 0)
  assert.equal(await locateWith({ request })('mock-key', active), null)
  assert.equal(await locateWith({ getFuzzyLocation: async () => { throw Error('未授权') }, request })('mock-key', active), null)
  assert.equal(await locateWith({ getFuzzyLocation: async () => ({ latitude: NaN, longitude: 116 }), request })('mock-key', active), null)
  let mounted = true
  assert.equal(await locateWith({ getFuzzyLocation: async () => { mounted = false; return fuzzy() }, request })('mock-key', () => mounted), null)
  assert.equal(sent, 0)
  assert.equal(await locateWith({ getFuzzyLocation: fuzzy, request })('mock-key', active), null)
  assert.equal(sent, 1)
})
