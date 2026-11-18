const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, modules) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require(name) { if (!(name in modules)) throw Error(`Unexpected dependency ${name}`); return modules[name] } })
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
test('new order serialization uses metadata, selected plans, integer cents and recoverable identity', () => {
  const storage = new Map(); let userId = 'u1'
  const normalize = load('src/services/product-normalize.ts', {})
  const config = { id: 'p1', title: 'Test', subtitle: '', servicePhone: '', formIssues: [], readRule: { mode: 'scroll', seconds: 0 }, forceRead: [], intro: { location: '', letterTitle: '', letterContent: '', serviceTime: '', companySlogan: '', media: { mode: 'images' }, agreements: [] },
    products: ['a', 'b'].map((id, i) => ({ id, name: id, type: '主险', company: '', required: true, defaultPlanId: id, plans: [{ id, name: id, premium: i ? 0.2 : 0.1, description: '', protections: [] }] })),
    fieldGroups: [{ id: 'g', name: 'Test', fields: [{ id: 'f', fieldName: 'englishKey', name: '显示名', type: '文本', placeholder: '', required: true }] }] }
  const draft = { productId: 'p1', productConfig: config, selectedPlans: { a: 'a', b: 'b' }, formValues: { f: 'SYNTHETIC' } }
  const modules = { '@tarojs/taro': { getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,v), removeStorageSync: k => storage.delete(k) }, './session': { getAuthSession: () => ({ userId }) }, './product-normalize': normalize, './product': { INSURANCE_DRAFT_KEY: 'draft' } }
  const service = load('src/services/order-draft.ts', modules)
  const request = service.newOrderRequest(draft, '1'); assert.equal(request.amount, 0.3); assert.equal(request.orderNo, undefined)
  const data = JSON.parse(request.orderData); assert.equal(data.blockConfigList[0].fieldConfig.englishKey, 'SYNTHETIC'); assert.equal(data.planGroupList[0].planList.length, 1)
  const key = service.creationKey('p1'); service.beginCreation(key)
  assert.throws(() => load('src/services/order-draft.ts', modules).beginCreation(key), /已有/); assert.throws(() => service.releaseKnownCreation(key, 'O1'), /未知/)
  service.persistCreation(key, { state: 'known', orderNo: 'O1' }); assert.equal(service.readCreation(key).orderNo, 'O1')
  userId = 'u2'; assert.equal(service.readCreation(service.creationKey('p1')), undefined)
  service.releaseKnownCreation(key, 'O1'); assert.equal(service.readCreation(key), undefined)
  delete config.fieldGroups[0].fields[0].fieldName; assert.throws(() => service.newOrderRequest(draft, '1'), /标识/ )
})
const request = { amount: 12, subject: 'test', channel: '9', method: '4', orderNo: 'O1' }
const pay = { success: true, orderNo: 'O1', timeStamp: '123', nonceStr: 'nonce', packageStr: 'prepay_id=abc', signType: 'RSA', paySign: 'signature' }
test('normal prepay persists response after unload and lost response does not retry', async () => {
  let active = true; let saved; let dispatched = 0; let calls = 0
  const order = load('src/services/order.ts', { '@tarojs/taro': {}, './api': { apiRequest: async () => { calls++; if (calls === 1) return { code: 200, msg: null }; active = false; return pay } } })
  await order.prepay(request, async () => { throw Error('unexpected prompt') }, () => active, () => dispatched++, value => { saved = value.orderNo })
  assert.equal(dispatched, 1); assert.equal(saved, 'O1'); assert.equal(calls, 2)
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
  assert.match(s.order.orderStatus({ orderNo: '1', payStatus: '1' }), /支付状态：1/); assert.equal(s.order.money(undefined), '待服务端确认')
})

function ordersPageSetup() {
  const slots = []; const calls = []; let cursor = 0; let didShow
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i] }
  }
  const jsx = (type, props) => ({ type, props })
  const Page = load('src/pages/orders/index.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@tarojs/components': { View: 'View', Text: 'Text', Input: 'Input', Button: 'Button' },
    '@tarojs/taro': { useDidShow: fn => { didShow = fn } },
    '../../hooks/use-order-lifecycle': { useOrderLifecycle: () => ({ capture: () => () => true }) },
    '../../services/order': { fetchOrders: (page, keyword) => new Promise((resolve, reject) => calls.push({ page, keyword, resolve, reject })), loadOrderDictionaries: async () => {}, message: e => e.message, money: v => `¥${v}` },
    './index.css': {}
  }).default
  const render = () => { cursor = 0; return Page() }
  return { calls, render, show: () => didShow() }
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
