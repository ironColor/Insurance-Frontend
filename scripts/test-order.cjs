const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, modules) {
  const exports = {}
  // Page and service modules share Error in the mini-program, also across these test VM contexts.
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Error, require(name) { if (!(name in modules)) throw Error(`Unexpected dependency ${name}`); return modules[name] } })
  return exports
}
function setup() {
  const calls = []; let response = { statusCode: 200, data: '{"code":200,"data":null}' }; let cleared = 0; let paymentError; let payment
  const taro = { request: async options => { calls.push(options); return response }, requestPayment: async options => { payment = options; if (paymentError) throw paymentError } }
  const json = load('src/services/json.ts', {})
  const api = load('src/services/api.ts', { '@tarojs/taro': taro, './session': { getAuthSession: () => ({ token: 'token', headerName: 'Wx-Authorization' }), clearAuthSession: () => cleared++ }, './json': json })
  const order = load('src/services/order.ts', { '@tarojs/taro': taro, './api': api })
  return { api, order, calls, response: value => { response = value }, cleared: () => cleared, paymentError: value => { paymentError = value }, payment: () => payment }
}
test('login sends xcxCode/clientId/appid then binds phoneCode using documented response', async () => {
  const calls = []; const sessions = []
  const auth = load('src/services/auth.ts', {
    '@tarojs/taro': { login: async () => ({ code: 'wx-code' }), getAccountInfoSync: () => ({ miniProgram: { appId: 'wx-app' } }) },
    './api': { apiRequest: async (...args) => { calls.push(args); return calls.length === 1 ? { apiToken: 'token', header: 'Wx-Authorization', userId: '9007199254740993' } : { phonenumber: '13800138000' } } },
    './session': { saveAuthSession: value => sessions.push(value), clearAuthSession() {}, userIdFromToken() {} }
  })
  const result = await auth.loginWithWechat('phone/code')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), { appid: 'wx-app', xcxCode: 'wx-code', clientId: '71f081db718ae2e719a9063f0444ab67' })
  assert.equal(calls[1][0], '/user/phone?phoneCode=phone%2Fcode'); assert.equal(result.phone, '13800138000'); assert.equal(sessions[1].phoneBound, true)
})
function safetySetup(storage = new Map()) {
  let userId = 'user-1'
  const modules = { '@tarojs/taro': { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value) }, './session': { getAuthSession: () => ({ userId }) } }
  return { safety: load('src/services/order-safety.ts', modules), reload: () => load('src/services/order-safety.ts', modules), user: value => { userId = value } }
}
test('all money actions fail closed regardless of unknown codes, timestamps or invented capabilities', () => {
  const { safety } = safetySetup()
  for (const action of ['pay', 'cancel', 'refund']) for (const payStatus of [undefined, '0', '1', 'paid']) {
    assert.ok(safety.orderActionBlockReason({ orderNo: 'O1', payStatus, payTime: '', capabilities: { [action]: true } }, action))
    assert.ok(safety.orderActionBlockReason({ orderNo: 'O1', payStatus, payTime: '2020-01-01' }, action))
  }
})
test('pending persists on remount/restart, scopes by user/order/action and cannot be resent', () => {
  const s = safetySetup()
  for (const action of ['cancel', 'refund']) {
    s.safety.beginOrderAction('O1', action)
    const reloaded = s.reload()
    assert.ok(reloaded.pendingBlockReason('O1', action))
    assert.throws(() => reloaded.beginOrderAction('O1', action), /重复提交/)
    assert.equal(reloaded.pendingBlockReason('O2', action), '')
    s.user('user-2'); assert.equal(reloaded.pendingBlockReason('O1', action), ''); s.user('user-1')
  }
  s.user(undefined)
  assert.ok(s.safety.pendingBlockReason('O1', 'pay'))
  assert.throws(() => s.safety.beginOrderAction('O1', 'pay'), /标识缺失/)
})
test('storage failure prevents dispatch and lifecycle generations never revive old continuations', () => {
  const safety = load('src/services/order-safety.ts', { '@tarojs/taro': { getStorageSync() { throw Error('unavailable') } }, './session': { getAuthSession: () => ({ userId: '1' }) } })
  assert.ok(safety.pendingBlockReason('O1', 'cancel'))
  assert.throws(() => safety.beginOrderAction('O1', 'cancel'))
  const guard = safety.createLifecycleGuard(); const first = guard.capture()
  assert.equal(first(), true); guard.dispose(); assert.equal(first(), false)
  guard.activate(); assert.equal(first(), false); assert.equal(guard.capture()(), true)
})
test('known state gates, legacy migration and manual refund recovery', () => {
  const storage = new Map(); const s = safetySetup(storage)
  assert.equal(s.safety.orderActionBlockReason({ orderStatus: 'NOTPAY' }, 'pay'), '')
  assert.equal(s.safety.orderActionBlockReason({ orderStatus: 'PAID' }, 'refund'), '')
  storage.set('insurance-order-pending:v1:user-1:O1:refund', { pending: true })
  s.safety.reconcileRefund({ orderNo: 'O1', orderStatus: 'PAID' })
  assert.ok(s.safety.pendingBlockReason('O1', 'refund'))
  storage.set('insurance-order-pending:v1:user-1:O1:pay', { pending: true })
  assert.equal(s.safety.pendingBlockReason('O1', 'pay'), '')
  const finish = s.safety.beginOrderAction('O2', 'refund')
  s.safety.reconcileRefund({ orderNo: 'O2', orderStatus: 'PAID' })
  assert.ok(s.safety.pendingBlockReason('O2', 'refund')); finish()
  s.safety.reconcileRefund({ orderNo: 'O2', orderStatus: 'PAID' })
  assert.equal(s.safety.pendingBlockReason('O2', 'refund'), '')
  const alive = s.safety.createLifecycleGuard().capture(); s.user('user-2'); assert.equal(alive(), false)
})
test('主险必选：优先可见默认方案，否则选排序第一项；附加险仍按配置选择', () => {
  const { normalizeProductConfig, createDefaultSelections, calculatePremium } = load('src/services/product-normalize.ts', {})
  for (const hasDefault of [false, true]) {
    const config = normalizeProductConfig({ productId: 'demo', planGroupList: [
      { groupId: 'main', groupName: '主险', classify: hasDefault ? 1 : '1', required: '0', planList: [
        { planId: 'hidden', visible: '0', isDefault: '1', sort: 0, price: 1 },
        { planId: 'plus', isDefault: hasDefault, sort: 2, price: 160 },
        { planId: 'basic', sort: 1, price: 120 }
      ] },
      { groupId: 'extra', classify: '2', required: '0', planList: [{ planId: 'opt', price: 20 }] },
      { groupId: 'requiredExtra', classify: 2, required: '1', planList: [{ planId: 'fixed', price: 10 }] }
    ] })
    const selected = createDefaultSelections(config)
    assert.deepEqual(Array.from(config.products, group => group.required), [true, false, true])
    assert.deepEqual({ ...selected }, { main: hasDefault ? 'plus' : 'basic', extra: null, requiredExtra: 'fixed' })
    assert.equal(calculatePremium(config, selected), hasDefault ? 170 : 130)
    assert.equal(calculatePremium(config, { ...selected, main: 'basic', extra: 'opt' }), 150)
    assert.throws(() => calculatePremium(config, { ...selected, main: null }), /请选择主险/)
  }
})

test('new order serialization uses metadata, selected plans and integer cents', () => {
  const normalize = load('src/services/product-normalize.ts', {})
  const config = { id: 'p1', title: 'Test', subtitle: '', servicePhone: '', formIssues: [], readRule: { mode: 'scroll', seconds: 0 }, forceRead: [], intro: { location: '', letterTitle: '', letterContent: '', serviceTime: '', companySlogan: '', media: { mode: 'images' }, agreements: [] },
    products: ['a', 'b'].map((id, i) => ({ id, name: id, type: '主险', company: '', required: true, defaultPlanId: id, plans: [{ id, name: id, premium: i ? 0.2 : 0.1, description: '', protections: [] }] })),
    fieldGroups: [{ id: 'g', name: 'Test', fields: [{ id: 'f', fieldName: 'englishKey', name: '显示名', type: '文本', placeholder: '', required: true }] }] }
  const draft = { productId: 'p1', productConfig: config, selectedPlans: { a: 'a', b: 'b' }, formValues: { f: 'SYNTHETIC' } }
  const modules = { '@tarojs/taro': {}, './product-normalize': normalize, './product': { INSURANCE_DRAFT_KEY: 'draft' } }
  const service = load('src/services/order-draft.ts', modules)
  const legacyConfig = { ...config, products: [{ ...config.products[0], required: false }, config.products[1]] }
  assert.throws(() => service.newOrderRequest({ ...draft, productConfig: legacyConfig, selectedPlans: { a: null, b: 'b' } }, '1'), /请选择a的投保方案/)
  const request = service.newOrderRequest(draft, '1'); assert.equal(request.amount, 0.3); assert.equal(request.orderNo, undefined)
  const data = JSON.parse(request.orderData); assert.equal(data.blockConfigList[0].fieldConfig.englishKey, 'SYNTHETIC'); assert.equal(data.planGroupList[0].planList.length, 1)

  delete config.fieldGroups[0].fields[0].fieldName; assert.throws(() => service.newOrderRequest(draft, '1'), /标识/ )
})
const request = { amount: 12, subject: 'test', channel: '9', method: '4', orderNo: 'O1' }
const pay = { success: true, orderNo: 'O1', timeStamp: '123', nonceStr: 'nonce', packageStr: 'prepay_id=abc', signType: 'RSA', paySign: 'signature' }
test('prepay returns the backend order number; lost response is not retried automatically', async () => {
  let dispatched = 0; let calls = 0
  const order = load('src/services/order.ts', { '@tarojs/taro': {}, './api': { apiRequest: async () => { calls++; return calls === 1 ? { code: 200, msg: null } : pay } } })
  const result = await order.prepay(request, async () => { throw Error('unexpected prompt') }, () => true, () => dispatched++)
  assert.equal(dispatched, 1); assert.equal(result.orderNo, 'O1'); assert.equal(calls, 2)
  const failed = load('src/services/order.ts', { '@tarojs/taro': {}, './api': { apiRequest: async path => { if (path.endsWith('validBeforePay')) return { code: 200 }; throw Error('timeout') } } })
  await assert.rejects(failed.prepay(request, async () => true), /timeout/)
})
test('refund success, dictionary filtering and yuan strings', async () => {
  const s = setup(); assert.equal(s.order.amountYuan('160.00'), 160); assert.throws(() => s.order.amountYuan('1.001'))
  s.response({ statusCode: 200, data: JSON.stringify({ code: 200, data: [{ dictLabel: 'Other', dictValue: '6' }, { dictLabel: 'Disabled', dictValue: '7', status: '1' }] }) })
  assert.equal((await s.order.fetchDictionary('pay_refund_reason')).length, 1)
  s.response({ statusCode: 200, data: '{"code":200,"data":{"success":true}}' })
  await s.order.applyRefund({ orderNo: 'O1', orderStatus: 'PAID', payAmount: '12.00' }, '6', '')
  await assert.rejects(s.order.applyRefund({ orderStatus: 'PAID' }, '', ''))
  await assert.rejects(s.order.applyRefund({ orderStatus: 'NOTPAY' }, '6', ''))
})
test('bare channel array and disabled filtering; no credentials in query', async () => {
  const s = setup(); s.response({ statusCode: 200, data: '[{"id":9223372036854775806,"status":"0"},{"id":2,"status":"1"}]' })
  const result = await s.order.fetchChannels('42'); assert.equal(result.length, 1); assert.equal(result[0].id, '9223372036854775806')
  assert.match(s.calls[0].url, /channelList\/42$/); assert.equal(s.calls[0].header['Wx-Authorization'], 'Bearer token')
})
test('table rows/total and query pagination, not nested data', async () => {
  const s = setup(); s.response({ statusCode: 200, data: '{"code":200,"rows":[{"orderNo":"A"}],"total":1}' })
  assert.equal((await s.order.fetchOrders(2, ' A ')).total, 1); assert.equal(s.calls[0].data.pageNum, 2); assert.equal(s.calls[0].data.orderNo, 'A')
})
test('query orderNo encoded, identity mismatch rejected', async () => {
  const s = setup(); s.response({ statusCode: 200, data: '{"code":200,"data":{"orderNo":"wrong"}}' })
  await assert.rejects(s.order.fetchOrder('A/B'), /异常/); assert.match(s.calls[0].url, /A%2FB$/)
})
for (const status of [401, 403, 500]) test(`HTTP ${status} never offers override or prepay`, async () => {
  const s = setup(); s.response({ statusCode: status, data: '{"code":400,"msg":"error"}' }); let prompts = 0
  await assert.rejects(s.order.prepay(request, async () => { prompts++; return true })); assert.equal(prompts, 0); assert.equal(s.calls.length, 1)
})
for (const code of [400, 401, 403, 500]) test(`business ${code} is not an overridable warning`, async () => {
  const s = setup(); s.response({ statusCode: 200, data: JSON.stringify({ code, msg: 'error' }) }); let prompts = 0
  await assert.rejects(s.order.prepay(request, async () => { prompts++; return true })); assert.equal(prompts, 0); assert.equal(s.calls.length, 1)
})
test('business warning cancel never creates order', async () => {
  const s = setup(); s.response({ statusCode: 200, data: '{"code":200,"msg":"duplicate"}' })
  assert.equal(await s.order.prepay(request, async () => false), null); assert.equal(s.calls.length, 1)
})
test('warning explicitly confirmed then posts exact request to prepay', async () => {
  const s = setup(); s.response({ statusCode: 200, data: '{"code":200,"msg":"duplicate"}' })
  const result = await s.order.prepay(request, async text => { assert.equal(text, 'duplicate'); s.response({ statusCode: 200, data: JSON.stringify({ code: 200, data: pay }) }); return true })
  assert.equal(result.orderNo, 'O1'); assert.equal(s.calls[1].method, 'POST'); assert.match(s.calls[1].url, /\/pay\/prepay$/); assert.equal(s.calls[1].data, request)
})
test('unload during validation prevents warning and prepay; inactive entry sends nothing', async () => {
  let resolve; const calls = []; let prompts = 0
  const guard = safetySetup().safety.createLifecycleGuard(); const isActive = guard.capture()
  const order = load('src/services/order.ts', { '@tarojs/taro': {}, './api': { apiRequest: (...args) => { calls.push(args); return new Promise(done => { resolve = done }) } } })
  const pending = order.prepay(request, async () => { prompts++; return true }, isActive)
  guard.dispose(); resolve({ code: 400 }); assert.equal(await pending, null)
  assert.equal(prompts, 0); assert.equal(calls.length, 1)
  assert.equal(await order.prepay(request, async () => true, isActive), null); assert.equal(calls.length, 1)
})
test('unload while confirmation open prevents prepay even after confirm', async () => {
  const s = setup(); s.response({ statusCode: 200, data: '{"code":200,"msg":"warning"}' })
  const guard = safetySetup().safety.createLifecycleGuard()
  assert.equal(await s.order.prepay(request, async () => { guard.dispose(); return true }, guard.capture()), null)
  assert.equal(s.calls.length, 1)
})
test('packageStr is mapped; client success remains submitted, cancellation and failure unknown', async () => {
  const s = setup(); assert.equal(await s.order.invokePayment(pay), 'submitted'); assert.equal(s.payment().package, pay.packageStr); assert.equal(s.payment().packageStr, undefined)
  s.paymentError({ errMsg: 'requestPayment:fail cancel' }); assert.equal(await s.order.invokePayment(pay), 'cancelled')
  s.paymentError({ errMsg: 'requestPayment:fail timeout' }); assert.equal(await s.order.invokePayment(pay), 'unknown')
})
test('missing signature, false success and missing orderNo prevent invoking payment', async () => {
  const s = setup()
  for (const bad of [{ ...pay, paySign: '' }, { ...pay, success: false }, { ...pay, orderNo: '' }]) await assert.rejects(s.order.invokePayment(bad))
  assert.equal(s.payment(), undefined)
})
test('refund submits no guessed amount/reason/status; success false rejected', async () => {
  const s = setup(); s.response({ statusCode: 200, data: '{"code":200,"data":{"success":false,"errorMsg":"rejected"}}' })
  await assert.rejects(s.order.applyRefund({ orderNo: 'O1', orderStatus: 'PAID', payAmount: '12.00' }, '6', 'reason'), /rejected/)
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls[0].data)), { orderNo: 'O1', refundAmount: 12, refundReason: '6', remark: 'reason', refundChannel: 1 })
})
test('cancel uses documented GET; refund states mapped only documented values', async () => {
  const s = setup(); await s.order.cancelOrder('O/1'); assert.equal(s.calls[0].method, 'GET'); assert.match(s.calls[0].url, /cancelOrder\/O%2F1$/)
  assert.equal(s.order.refundStatus('SUCCESS'), '退款成功'); assert.match(s.order.refundStatus('99'), /99/)
  assert.match(s.order.orderStatus({ orderNo: '1', payStatus: '1' }), /支付状态：1/); assert.equal(s.order.money(undefined), '待确认')
})

function renderOrderPage(path, modules) {
  const slots = []; let cursor = 0; let didShow
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i] }
  }
  const jsx = (type, props) => ({ type, props })
  const Page = load(path, {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@tarojs/components': { View: 'View', Text: 'Text', Input: 'Input', Button: 'Button' },
    '../../hooks/use-order-lifecycle': { useOrderLifecycle: () => ({ capture: () => () => true }) },
    './index.css': {}, ...modules,
    '@tarojs/taro': { ...modules['@tarojs/taro'], useDidShow: fn => { didShow = fn } }
  }).default
  const render = () => { cursor = 0; return Page() }
  return { render, show: () => didShow() }
}
function ordersPageSetup() {
  const calls = []
  return { calls, ...renderOrderPage('src/pages/orders/index.tsx', {
    '../../services/order': { fetchOrders: (page, keyword) => new Promise((resolve, reject) => calls.push({ page, keyword, resolve, reject })), loadOrderDictionaries: async () => {}, message: e => e.message, money: v => `¥${v}` }
  }) }
}
function pageNodes(node) {
  if (Array.isArray(node)) return node.flatMap(pageNodes)
  if (!node || typeof node !== 'object') return []
  return [node, ...pageNodes(node.props?.children)]
}
function pageText(node) {
  if (Array.isArray(node)) return node.map(pageText).join('')
  if (node && typeof node === 'object') return pageText(node.props?.children)
  return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}
const tick = () => new Promise(resolve => setImmediate(resolve))

async function checkoutFixture(options = {}) {
  const calls = []; const redirects = []; const logins = []; let orderReads = 0; let rejected = false; let prepayCount = 0
  const accessedStorage = []
  const storage = new Map(options.legacyCreation ? [['insurance-create:v2:user-1:P', options.legacyCreation]] : [])
  const isDraft = !!options.newOrder
  const draft = { productId: 'P', productConfig: { title: '测试产品' } }
  const session = () => ({ token: 'token', userId: 'user-1', headerName: 'Wx-Authorization' })
  let auth = options.guest ? null : session()
  const sessionModule = { getAuthSession: () => auth, clearAuthSession: () => { auth = null } }
  const platform = {
    getStorageSync: key => { accessedStorage.push(key); return key === 'draft' ? draft : storage.get(key) },
    setStorageSync: (key, value) => { accessedStorage.push(key); storage.set(key, value) },
    removeStorageSync: key => { accessedStorage.push(key); storage.delete(key) },
    useRouter: () => ({ params: isDraft ? { productId: 'P' } : { orderNo: 'O1' } }),
    redirectTo: async ({ url }) => { redirects.push(url) },
    navigateTo: async ({ url }) => { logins.push(url) },
    requestPayment: async () => { calls.push('wx.requestPayment') },
    request: async ({ url, data: request }) => {
      const path = new URL(url).pathname.replace('/prod-api/wxmini', '')
      const ok = data => ({ statusCode: 200, data: { code: 200, data } })
      calls.push(path)
      if (path === options.rejectAt && !rejected) {
        rejected = true; return options.legacyRejection ? { statusCode: 200, data: { code: 500, msg: '请先登录', data: null } } : { statusCode: 401, data: {} }
      }
      if (path.startsWith('/pay/channelList/')) return { statusCode: 200, data: [{ id: 'wx1', status: '0', name: '微信支付' }] }
      if (path.startsWith('/order/getOrderByOrderNo/')) {
        orderReads++; return ok({ productId: 'P', orderNo: 'O1', orderStatus: 'NOTPAY', payAmount: orderReads > 1 && options.priceChange ? '161.00' : '160.00', orderData: '{}', productTitle: '测试产品' })
      }
      if (path === '/pay/validBeforePay') { assert.equal(request.channel, 'wx1'); assert.equal(request.amount, 160); assert.equal(request.orderNo, isDraft ? undefined : 'O1'); return ok(null) }
      if (path === '/pay/prepay') { if (++prepayCount === 1 && options.timeout) throw Error('测试超时'); return ok(pay) }
      throw Error('意外请求：' + path)
    }
  }
  const api = load('src/services/api.ts', { '@tarojs/taro': platform, './session': sessionModule, './json': load('src/services/json.ts', {}) })
  const order = load('src/services/order.ts', { '@tarojs/taro': platform, './api': api })
  const safety = load('src/services/order-safety.ts', { '@tarojs/taro': platform, './session': sessionModule })
  const lifecycle = safety.createLifecycleGuard()
  const product = { INSURANCE_DRAFT_KEY: 'draft' }
  const orderDraft = load('src/services/order-draft.ts', { '@tarojs/taro': platform, './session': sessionModule, './product': product, './product-normalize': {} })
  const page = renderOrderPage('src/pages/payment/index.tsx', {
    '@tarojs/taro': platform, '../../hooks/use-order-lifecycle': { useOrderLifecycle: () => lifecycle },
    '../../services/api': api, '../../services/session': sessionModule,
    '../../services/order': order, '../../services/order-safety': safety, '../../services/product': product,
    '../../services/order-draft': { ...orderDraft, newOrderRequest: (_, channel) => ({ amount: 160, subject: '测试产品', channel, method: '4' }) }
  })
  page.render(); page.show(); await tick()
  const buttons = () => pageNodes(page.render()).filter(n => n.type === 'Button')
  return { ...page, calls, redirects, logins, buttons, accessedStorage, login: (userId = 'user-1') => { auth = { ...session(), token: 'new-token', userId }; page.show() } }
}
for (const newOrder of [false, true]) test(`支付页${newOrder ? '新单' : '续付'}：仅一个微信支付入口，一次点击调起原生支付，连点不重复`, async () => {
  const s = await checkoutFixture({ newOrder }); assert.equal(s.buttons().length, 1)
  const button = s.buttons()[0]; assert.match(pageText(button), /微信支付.*160\.00/)
  assert.ok(!s.calls.includes('/pay/prepay')); const first = button.props.onClick(); await button.props.onClick(); await first
  assert.equal(s.calls.filter(p => p === '/pay/prepay').length, 1); assert.equal(s.calls.filter(p => p === 'wx.requestPayment').length, 1)
  assert.deepEqual(s.redirects, ['/pages/pay-result/index?orderNo=O1&outcome=submitted'])
})
test('支付页：金额变更停止付款，请用户重新核对', async () => {
  const s = await checkoutFixture({ priceChange: true }); await s.buttons()[0].props.onClick()
  assert.match(pageText(s.render()), /应付金额已更新/); assert.deepEqual(s.buttons().map(pageText), ['重新加载'])
  assert.ok(!s.calls.includes('/pay/prepay')); assert.ok(!s.calls.includes('wx.requestPayment'))
})
test('支付页：预支付超时后可手动重试，不自动付款或记录本地下单状态', async () => {
  const s = await checkoutFixture({ newOrder: true, timeout: true }); await s.buttons()[0].props.onClick()
  assert.match(pageText(s.render()), /未能确认预支付结果/)
  assert.deepEqual(s.buttons().map(pageText), ['重新加载']); s.buttons()[0].props.onClick(); await tick()
  assert.match(pageText(s.buttons()[0]), /微信支付/); assert.equal(s.calls.filter(p => p === '/pay/prepay').length, 1)
  assert.ok(!s.calls.includes('wx.requestPayment'))
  await s.buttons()[0].props.onClick()
  assert.equal(s.calls.filter(p => p === '/pay/prepay').length, 2)
  assert.equal(s.calls.filter(p => p === 'wx.requestPayment').length, 1)
  assert.deepEqual([...new Set(s.accessedStorage)], ['draft'])
})
for (const legacyCreation of [{ state: 'pending' }, { state: 'known', orderNo: 'OLD' }]) test(`支付页：忽略旧本地下单记录 ${legacyCreation.state}`, async () => {
  const s = await checkoutFixture({ newOrder: true, legacyCreation })
  assert.deepEqual(s.calls, ['/pay/channelList/P']); assert.match(pageText(s.buttons()[0]), /微信支付/)
  await s.buttons()[0].props.onClick()
  assert.deepEqual(s.calls, ['/pay/channelList/P', '/pay/validBeforePay', '/pay/prepay', 'wx.requestPayment'])
  assert.deepEqual([...new Set(s.accessedStorage)], ['draft'])
})
test('支付页：未登录不发送请求，登录回到原订单后只查询、不自动付款', async () => {
  const s = await checkoutFixture({ guest: true })
  assert.deepEqual(s.calls, []); assert.deepEqual(s.buttons().map(pageText), ['去登录'])
  await s.buttons()[0].props.onClick(); assert.deepEqual(s.logins, ['/pages/login/index?returnToPayment=1'])
  s.login(); await tick()
  assert.deepEqual(s.calls, ['/order/getOrderByOrderNo/O1', '/pay/channelList/P'])
  assert.match(pageText(s.buttons()[0]), /微信支付/); assert.deepEqual(s.redirects, [])
})
for (const rejectAt of ['/pay/validBeforePay', '/pay/prepay']) test(`支付页：${rejectAt} 明确拒绝登录，返回后等待手动付款`, async () => {
  const s = await checkoutFixture({ newOrder: true, rejectAt, legacyRejection: true })
  await s.buttons()[0].props.onClick(); assert.deepEqual(s.buttons().map(pageText), ['去登录'])
  assert.ok(!s.calls.includes('wx.requestPayment')); assert.deepEqual(s.redirects, [])
  await s.buttons()[0].props.onClick(); const before = s.calls.length
  s.login(); await tick()
  assert.deepEqual(s.calls.slice(before), ['/pay/channelList/P']); assert.match(pageText(s.buttons()[0]), /微信支付/)
  await s.buttons()[0].props.onClick(); assert.equal(s.calls.filter(p => p === 'wx.requestPayment').length, 1)
})
test('支付页：预支付收到 401 后返回原草稿，仍需手动支付', async () => {
  const s = await checkoutFixture({ newOrder: true, rejectAt: '/pay/prepay' })
  await s.buttons()[0].props.onClick(); assert.deepEqual(s.buttons().map(pageText), ['去登录'])
  s.login(); await tick()
  assert.match(pageText(s.buttons()[0]), /微信支付/); assert.ok(!s.calls.includes('wx.requestPayment'))
  assert.equal(s.calls.filter(p => p === '/pay/prepay').length, 1)
  await s.buttons()[0].props.onClick(); assert.equal(s.calls.filter(p => p === 'wx.requestPayment').length, 1)
})
test('支付页：重新登录为不同账号，不恢复旧账号的投保草稿', async () => {
  const s = await checkoutFixture({ newOrder: true, rejectAt: '/pay/validBeforePay', legacyRejection: true })
  await s.buttons()[0].props.onClick(); const count = s.calls.length
  s.login('user-2'); await tick()
  assert.match(pageText(s.render()), /登录账号已变更/); assert.equal(s.calls.length, count)
})
test('order page first paint and searching use centered loading, then styled empty/error states', async () => {
  const s = ordersPageSetup(); let tree = s.render()
  assert.match(pageText(pageNodes(tree).find(n => n.props.className === 'orders-state')), /正在查询订单/)
  assert.doesNotMatch(pageText(tree), /暂无订单/)
  s.show(); s.calls[0].resolve({ rows: [], total: 0 }); await tick(); tree = s.render()
  assert.match(pageText(tree), /暂无订单/); assert.match(pageText(tree), /去看看产品/)
  pageNodes(tree).find(n => n.type === 'Input').props.onInput({ detail: { value: ' A ' } }); tree = s.render()
  pageNodes(tree).find(n => n.type === 'Input').props.onConfirm(); tree = s.render()
  assert.equal(s.calls[1].keyword, 'A'); assert.doesNotMatch(pageText(tree), /暂无订单/)
  assert.match(pageText(pageNodes(tree).find(n => n.props.className === 'orders-state')), /正在查询订单/)
  s.calls[1].reject(Error('测试网络故障')); await tick(); tree = s.render()
  assert.match(pageText(pageNodes(tree).find(n => n.props.className === 'orders-state')), /订单暂时无法加载/)
  pageNodes(tree).find(n => n.type === 'Button' && pageText(n) === '重新加载').props.onClick()
  s.calls[2].resolve({ rows: [], total: 0 }); await tick(); tree = s.render()
  assert.match(pageText(tree), /未找到相关订单/); assert.match(pageText(tree), /查看全部订单/)
})
test('load-more retries the failed page with submitted query, retaining existing cards', async () => {
  const s = ordersPageSetup(); s.render(); s.show()
  s.calls[0].resolve({ rows: [{ orderNo: 'DEMO1', orderStatus: 'NOTPAY', totalAmount: 120 }], total: 21 }); await tick()
  let tree = s.render(); pageNodes(tree).find(n => n.type === 'Input').props.onInput({ detail: { value: 'UNSUBMITTED' } }); tree = s.render()
  const more = pageNodes(tree).find(n => n.type === 'Button' && pageText(n) === '加载更多订单')
  more.props.onClick(); more.props.onClick(); assert.equal(s.calls.length, 2); tree = s.render()
  assert.match(pageText(pageNodes(tree).find(n => n.props.className === 'orders-list-footer')), /正在加载更多/)
  assert.equal(pageNodes(tree).filter(n => n.props.className === 'order-card').length, 1)
  assert.equal(s.calls[1].keyword, ''); assert.equal(s.calls[1].page, 2)
  s.calls[1].reject(Error('测试分页失败')); await tick(); tree = s.render()
  pageNodes(tree).find(n => n.type === 'Button' && pageText(n) === '重新加载').props.onClick()
  assert.equal(s.calls[2].page, 2); assert.equal(s.calls[2].keyword, '')
  s.calls[2].resolve({ rows: [{ orderNo: 'DEMO2' }], total: 2 }); await tick(); tree = s.render()
  assert.equal(pageNodes(tree).filter(n => n.props.className === 'order-card').length, 2)
  assert.match(pageText(tree), /已显示全部订单/)
})

test('订单详情：按历史快照解析多方案、分区和字段标签，不依赖当前产品配置', () => {
  const detail = load('src/services/order-detail.ts', { './json': load('src/services/json.ts', {}) })
  const result = detail.parseOrderDetail({
    fieldData: JSON.stringify([{ fieldName: 'studentName', fieldLabel: '学生姓名' }]),
    orderData: JSON.stringify({ productName: '历史产品', planGroupList: [
      { sort: 2, groupName: '附加险', insCompanyName: '模拟公司乙', planList: [{ planName: '附加计划' }] },
      { sort: 1, groupName: '主险', insCompanyName: '模拟公司甲', planList: [{ sort: 2, planName: '计划乙' }, { sort: 1, planName: '计划甲' }] }
    ], blockConfigList: [
      { sort: 2, blockName: '学生信息', fieldConfig: { studentName: '模拟学生', grade: '高一' } },
      { sort: 1, blockName: '家长信息', fieldConfig: { parentName: '模拟家长' } }
    ] })
  })
  assert.equal(result.productName, '历史产品')
  assert.deepEqual(JSON.parse(JSON.stringify(result.plans)), [
    { name: '主险', company: '模拟公司甲', plans: '计划甲、计划乙' },
    { name: '附加险', company: '模拟公司乙', plans: '附加计划' }
  ])
  assert.equal(result.sections[0].name, '家长信息')
  assert.equal(result.sections[1].fields[0].label, '学生姓名')
  assert.equal(result.sections[1].fields[1].label, '信息 2')
})
test('订单详情：空或损坏快照可降级，fieldData 缺失时仍显示投保值', () => {
  const { parseOrderDetail } = load('src/services/order-detail.ts', { './json': load('src/services/json.ts', {}) })
  for (const orderData of [undefined, '', '{', 'null', '[]']) {
    const result = parseOrderDetail({ orderData })
    assert.equal(result.plans.length, 0); assert.equal(result.sections.length, 0)
  }
  for (const fieldData of [null, '{']) {
    const result = parseOrderDetail({ fieldData, orderData: '{"blockConfigList":[null,{"blockName":"投保人","fieldConfig":{"name":"模拟家长","empty":null,"zero":0,"checked":false,"choice":["甲","乙"],"object":{"hidden":"不展示"}}}]}' })
    assert.deepEqual(Array.from(result.sections[0].fields, field => field.value), ['模拟家长', '—', '0', 'false', '甲、乙', '—'])
  }
})
test('订单详情：排除危险字段键，保留快照中的长数字文本', () => {
  const { parseOrderDetail } = load('src/services/order-detail.ts', { './json': load('src/services/json.ts', {}) })
  const result = parseOrderDetail({ orderData: '{"blockConfigList":[{"fieldConfig":{"constructor":"不可展示","__proto__":{"polluted":true},"documentNo":9007199254740993}}]}' })
  assert.equal(result.sections[0].fields.length, 1)
  assert.equal(result.sections[0].fields[0].value, '9007199254740993')
})

test('网络超时：普通接口为 60 秒，支付前校验不传显式 timeout', async () => {
  const s = setup()
  await s.api.apiRequest('/product/allInfo/P', 'GET')
  assert.equal(s.calls[0].timeout, 60000)
  for (const path of ['/pay/validBeforePay', '/pay/validBeforePay?probe=1']) {
    await s.api.apiRequest(path, 'POST', {}, 'validation')
    assert.equal(Object.prototype.hasOwnProperty.call(s.calls.at(-1), 'timeout'), false)
  }
  await s.api.apiRequest('/pay/prepay', 'POST', {})
  assert.equal(s.calls.at(-1).timeout, 60000)
  let uploadOptions
  const api = load('src/services/api.ts', {
    '@tarojs/taro': { uploadFile: async options => { uploadOptions = options; return { statusCode: 200, data: '{"code":200,"data":"ok"}' } } },
    './session': { getAuthSession: () => ({ token: 'test', headerName: 'Wx-Authorization' }) },
    './json': load('src/services/json.ts', {})
  })
  await api.apiUpload('/upload', '/tmp/test.png')
  assert.equal(uploadOptions.timeout, 60000)
})

test('订单详情中文名称：历史标签优先，缺失标签由产品配置补齐且不覆盖快照值', async () => {
  const detail = load('src/services/order-detail.ts', { './json': load('src/services/json.ts', {}) })
  const calls = []
  const service = load('src/services/order-field-labels.ts', {
    './order-detail': detail,
    './api': { apiRequest: async (path, method) => {
      calls.push({ path, method })
      return { productId: 'P', blockConfigList: [{ blockName: '投保人', fieldConfigList: [
        { fieldName: 'parentName', fieldLabel: '最新家长姓名', defaultValue: '不可覆盖' },
        { fieldName: 'parentPhone', fieldLabel: '家长手机号', defaultValue: '不可覆盖' }
      ] }] }
    } }
  })
  const order = { productId: 'P', fieldData: '[{"fieldName":"parentName","fieldLabel":"历史家长姓名"}]', orderData: '{"blockConfigList":[{"blockName":"投保人","fieldConfig":{"parentName":"历史模拟家长","parentPhone":"模拟手机号"}}]}' }
  const result = detail.parseOrderDetail(order, await service.fetchOrderFieldLabels(order))
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/product/allInfo/P'); assert.equal(calls[0].method, 'GET')
  assert.equal(result.sections[0].fields[0].label, '历史家长姓名')
  assert.equal(result.sections[0].fields[1].label, '家长手机号')
  assert.equal(result.sections[0].fields[0].value, '历史模拟家长')
  assert.equal(result.hasMissingLabels, false)
  await service.fetchOrderFieldLabels({ ...order, fieldData: '[{"fieldName":"parentName","fieldLabel":"家长姓名"},{"fieldName":"parentPhone","fieldLabel":"家长手机号"}]' })
  assert.equal(calls.length, 1)
})
test('订单详情中文名称：标签按区块匹配，未知字段显示中文占位而非接口英文键', () => {
  const detail = load('src/services/order-detail.ts', { './json': load('src/services/json.ts', {}) })
  const labels = detail.orderFieldLabels([{ blockName: '投保人', fieldConfigList: [{ fieldName: 'name', fieldLabel: '家长姓名' }] }, { blockName: '被保险人', fieldConfigList: [{ fieldName: 'name', fieldLabel: '学生姓名' }] }])
  const order = { fieldData: null, orderData: '{"blockConfigList":[{"blockName":"投保人","fieldConfig":{"name":"模拟家长"}},{"blockName":"被保险人","fieldConfig":{"name":"模拟学生","unknownField":"历史值"}}]}' }
  const result = detail.parseOrderDetail(order, labels)
  assert.equal(result.sections[0].fields[0].label, '家长姓名')
  assert.equal(result.sections[1].fields[0].label, '学生姓名')
  assert.equal(result.sections[1].fields[1].label, '信息 2')
  assert.equal(result.sections[1].fields[1].value, '历史值')
  assert.equal(result.hasMissingLabels, true)
})
test('订单详情中文名称：缺少产品标识或返回产品不符时不误用标签', async () => {
  const detail = load('src/services/order-detail.ts', { './json': load('src/services/json.ts', {}) })
  let count = 0
  const service = load('src/services/order-field-labels.ts', { './order-detail': detail, './api': { apiRequest: async () => { count++; return { productId: 'OTHER', blockConfigList: [{ fieldConfigList: [{ fieldName: 'name', fieldLabel: '不应展示' }] }] } } } })
  const order = { orderData: '{"blockConfigList":[{"fieldConfig":{"name":"模拟学生"}}]}' }
  assert.equal((await service.fetchOrderFieldLabels(order)).length, 0); assert.equal(count, 0)
  assert.equal((await service.fetchOrderFieldLabels({ ...order, productId: 'P' })).length, 0); assert.equal(count, 1)
})

test('退款申请：原因单选与须知确认后才可提交，切换选项不触发退款', async () => {
  let submitted = 0
  const page = renderOrderPage('src/pages/refund-apply/index.tsx', {
    '../../hooks/use-order': { useOrder: () => ({ order: { orderNo: 'DEMO1', orderStatus: 'PAID', payAmount: '160.00' }, loading: false, error: '', reload() {}, isCurrent: () => true }) },
    '../../services/order': { fetchDictionary: async () => [{ dictLabel: '不想投了', dictValue: 'reason-1' }, { dictLabel: '其他', dictValue: 'reason-2' }], money: value => `¥${value}`, message: e => e.message, applyRefund: async () => { submitted++ } },
    '../../services/order-safety': { orderActionBlockReason: () => '', pendingBlockReason: () => '' }
  })
  const buttons = () => pageNodes(page.render()).filter(n => n.type === 'Button')
  const submit = () => buttons().find(n => pageText(n) === '提交退款申请')
  page.render(); page.show(); await tick()
  assert.equal(submit().props.disabled, true)
  buttons().find(n => pageText(n) === '不想投了').props.onClick()
  assert.equal(submit().props.disabled, true)
  buttons().find(n => /我已阅读并确认/.test(pageText(n))).props.onClick()
  assert.equal(submit().props.disabled, false)
  buttons().find(n => pageText(n) === '其他').props.onClick()
  const selected = buttons().filter(n => n.props.className?.includes('refund-choice-selected'))
  assert.equal(selected.length, 1); assert.match(pageText(selected[0]), /其他/)
  buttons().find(n => /我已阅读并确认/.test(pageText(n))).props.onClick()
  assert.equal(submit().props.disabled, true); assert.equal(submitted, 0)
})
test('退款申请：加载时仅显示等待状态，失败后显示重新查询按钮', () => {
  let state = { order: null, loading: true, error: '', reload() {} }
  const page = renderOrderPage('src/pages/refund-apply/index.tsx', {
    '../../hooks/use-order': { useOrder: () => state }, '../../services/order': {}, '../../services/order-safety': {}
  })
  let tree = page.render()
  assert.match(pageText(tree), /正在查询订单/)
  assert.equal(pageNodes(tree).filter(n => n.type === 'Button').length, 0)
  state = { ...state, loading: false, error: '模拟网络错误' }; tree = page.render()
  assert.match(pageText(tree), /订单暂时无法加载.*模拟网络错误/)
  assert.equal(pageNodes(tree).filter(n => n.type === 'Button').length, 1)
})
