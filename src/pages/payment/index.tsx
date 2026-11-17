import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { amountYuan, fetchChannels, fetchOrder, fetchOrderById, invokePayment, message, money, PayChannel, PayRequest, prepay, ServerOrder } from '../../services/order'
import { useOrderLifecycle } from '../../hooks/use-order-lifecycle'
import { orderActionBlockReason } from '../../services/order-safety'
import { beginCreation, creationKey, draftVersion, newOrderRequest, persistCreation, readCreation, releaseKnownCreation } from '../../services/order-draft'
import { INSURANCE_DRAFT_KEY, InsuranceDraft } from '../../services/product'
import './index.css'

export default function PaymentPage() {
  const params = useRouter().params
  const [order, setOrder] = useState<ServerOrder | null>(null)
  const [draft, setDraft] = useState<InsuranceDraft | null>(null)
  const [channels, setChannels] = useState<PayChannel[]>([])
  const [channel, setChannel] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const lifecycle = useOrderLifecycle()
  const sequence = useRef(0)
  const version = useRef('')
  const loadedFor = useRef<() => boolean>(() => false)
  const load = async () => {
    const alive = lifecycle.capture()
    const ticket = ++sequence.current
    const isActive = () => alive() && ticket === sequence.current
    loadedFor.current = () => false
    setError(''); setOrder(null); setDraft(null); setChannels([]); setChannel('')
    try {
      let value: ServerOrder | null = null
      let productId = params.productId
      if (params.orderNo || params.id) value = params.orderNo ? await fetchOrder(params.orderNo) : await fetchOrderById(params.id!)
      else {
        const saved = readCreation(creationKey(productId || ''))
        if (saved?.orderNo) value = await fetchOrder(saved.orderNo)
        else if (saved) throw new Error('上次下单结果未确认。为避免重复订单，请查询我的订单；查无订单时请联系客服核实，勿再次新建。')
        else {
          const stored = Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY)
          if (!stored || stored.productId !== productId) throw new Error('草稿已失效，请返回产品重新填写')
          newOrderRequest(stored, 'validate')
          version.current = draftVersion()
          if (isActive()) setDraft(stored)
        }
      }
      if (!isActive()) return
      if (value) { setOrder(value); productId = String(value.productId || '') }
      if (!productId) throw new Error('产品标识缺失')
      const available = await fetchChannels(productId)
      if (isActive()) { loadedFor.current = alive; setChannels(available); setChannel(String(available[0]?.id || '')) }
    } catch (error) { if (isActive()) setError(message(error)) }
  }
  useDidShow(() => { if (!lock.current) void load() })
  const pay = async () => {
    const alive = lifecycle.capture()
    const isActive = () => alive() && loadedFor.current() && (!!order || draftVersion() === version.current)
    if (!isActive() || (!order && !draft) || !channel || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      let request: PayRequest
      const key = draft ? creationKey(draft.productId) : ''
      if (order) {
        const latest = await fetchOrder(order.orderNo)
        if (!isActive()) return
        setOrder(latest)
        const reason = orderActionBlockReason(latest, 'pay')
        if (reason) throw new Error(reason)
        if (!latest.orderData || latest.productId == null) throw new Error('订单投保数据缺失，请联系客服')
        request = { orderNo: latest.orderNo, productId: latest.productId, amount: amountYuan(latest.payAmount), subject: latest.productName || latest.productTitle || `订单 ${latest.orderNo}`, orderData: latest.orderData, channel, method: '4' }
      } else request = newOrderRequest(draft!, channel)
      const result = await prepay(request, async content => {
        const answer = await Taro.showModal({ title: '投保业务提示', content, confirmText: '继续支付' })
        return isActive() && answer.confirm
      }, isActive, () => { if (key) beginCreation(key) }, response => {
        if (key && response?.orderNo) persistCreation(key, { state: 'known', orderNo: response.orderNo })
      })
      if (!isActive() || !result) return
      if (request.orderNo && result.orderNo !== request.orderNo) throw new Error('预支付订单号与当前订单不一致，已停止微信支付')
      const outcome = await invokePayment(result)
      if (isActive()) await Taro.redirectTo({ url: `/pages/pay-result/index?orderNo=${encodeURIComponent(result.orderNo!)}&outcome=${outcome}` })
    } catch (error) { if (alive()) setError(`${message(error)}。如已提交，请查询我的订单确认结果。`) }
    finally { lock.current = false; if (lifecycle.capture()()) { setBusy(false); if (!alive()) void load() } }
  }
  const startAnother = async () => {
    const alive = lifecycle.capture()
    if (!order || !params.productId || !loadedFor.current()) return
    const key = creationKey(params.productId)
    const answer = await Taro.showModal({ title: '另填一份投保', content: '原订单仍保留在我的订单。确认要重新填写另一份投保，而不是继续支付原订单？' })
    if (!alive() || !answer.confirm) return
    try {
      releaseKnownCreation(key, order.orderNo)
      Taro.removeStorageSync(INSURANCE_DRAFT_KEY)
      await Taro.redirectTo({ url: `/pages/plan/index?productId=${encodeURIComponent(params.productId)}` })
    } catch (error) { setError(message(error)) }
  }
  const blockReason = order ? orderActionBlockReason(order, 'pay') : ''
  return <View className='payment-page'>
    {error && <View className='payment-card'>{error}</View>}
    {(order || draft) && <><View className='payment-amount'><Text>应付金额</Text><Text>{money(order ? order.payAmount : draft?.totalPremium)}</Text></View>
      <View className='payment-card'>{order ? `订单号：${order.orderNo}` : draft?.productConfig.title}</View>
      <View className='payment-card'><Text>请选择支付渠道</Text>{channels.map(item => <Button key={String(item.id)} disabled={busy} onClick={() => setChannel(String(item.id))}>{channel === String(item.id) ? '✓ ' : ''}{item.name || item.code || item.id}</Button>)}{!channels.length && <Text>暂无可用渠道</Text>}</View>
      <Text>支付完成后将查询服务端到账结果。</Text>{blockReason && <View>{blockReason}</View>}
      <Button disabled={busy || !channel || !!blockReason} loading={busy} onClick={pay}>确认支付</Button></>}
    {order && params.productId && !params.orderNo && !params.id && <Button disabled={busy} onClick={startAnother}>另填一份投保</Button>}
    <Button disabled={busy} onClick={load}>刷新并恢复订单</Button>
    <Button disabled={busy} onClick={() => Taro.redirectTo({ url: '/pages/orders/index' })}>查询我的订单</Button>
  </View>
}
