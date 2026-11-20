import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { amountYuan, fetchChannels, fetchOrder, fetchOrderById, invokePayment, message, money, prepay } from '../../services/order'
import type { PayChannel, PayRequest, ServerOrder } from '../../services/order'
import { useOrderLifecycle } from '../../hooks/use-order-lifecycle'
import { orderActionBlockReason } from '../../services/order-safety'
import { beginCreation, creationKey, draftVersion, newOrderRequest, persistCreation, readCreation, releaseKnownCreation } from '../../services/order-draft'
import { INSURANCE_DRAFT_KEY, type InsuranceDraft } from '../../services/product'
import './index.css'

type Source = { kind: 'draft'; draft: InsuranceDraft; version: string } | { kind: 'order'; order: ServerOrder; restored: boolean }
type Ready = { kind: 'ready'; source: Source; channels: PayChannel[]; amount: number; current: () => boolean }
type Notice = { kind: 'notice'; title: string; text: string; action: 'reload' | 'orders' | 'detail' | 'back'; orderNo?: string; restored?: ServerOrder }
type Screen = { kind: 'loading' } | Ready | Notice

const uncertain: Notice = {
  kind: 'notice', title: '订单结果待确认', text: '请先在我的订单中核对结果。查不到时请联系客服，不要重复下单。', action: 'orders'
}

export default function PaymentPage() {
  const params = useRouter().params
  const lifecycle = useOrderLifecycle()
  const sequence = useRef(0)
  const lock = useRef(false)
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' })
  const [payingId, setPayingId] = useState<string | null>(null)
  const [restarting, setRestarting] = useState(false)
  const busy = payingId !== null || restarting

  const load = async () => {
    if (lock.current) return
    const alive = lifecycle.capture()
    const ticket = ++sequence.current
    const current = () => alive() && sequence.current === ticket
    const show = (next: Screen) => { if (current()) setScreen(next) }
    show({ kind: 'loading' })
    try {
      let source: Source
      if (params.orderNo || params.id) {
        const order = params.orderNo ? await fetchOrder(params.orderNo) : await fetchOrderById(params.id!)
        source = { kind: 'order', order, restored: false }
      } else {
        const productId = params.productId
        if (!productId) throw new Error('缺少产品信息，请返回重新选择')
        const saved = readCreation(creationKey(productId))
        if (saved?.orderNo) {
          const order = await fetchOrder(saved.orderNo)
          if (String(order.productId) !== productId) throw new Error('恢复的订单与当前产品不一致，请从我的订单查看')
          source = { kind: 'order', order, restored: true }
        } else if (saved) {
          show(uncertain); return
        } else {
          const draft = Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY)
          if (!draft || draft.productId !== productId) {
            show({ kind: 'notice', title: '投保信息已失效', text: '请返回核对投保信息后再支付。', action: 'back' }); return
          }
          source = { kind: 'draft', draft, version: draftVersion() }
        }
      }
      if (!current()) return
      if (source.kind === 'order') {
        const reason = orderActionBlockReason(source.order, 'pay')
        if (reason) {
          show({ kind: 'notice', title: '当前订单无需继续支付', text: reason, action: 'detail', orderNo: source.order.orderNo, restored: source.restored ? source.order : undefined }); return
        }
      }
      const productId = source.kind === 'order' ? source.order.productId : source.draft.productId
      if (productId == null || !String(productId).trim()) throw new Error('产品标识缺失')
      const amount = source.kind === 'order' ? amountYuan(source.order.payAmount) : newOrderRequest(source.draft, 'validate').amount
      const channels = (await fetchChannels(productId)).filter(item => String(item.id).trim())
      if (!channels.length) {
        show({ kind: 'notice', title: '暂无可用支付方式', text: '该产品暂时无法支付，请稍后重试。', action: 'reload' }); return
      }
      show({ kind: 'ready', source, amount, channels, current })
    } catch (error) {
      show({ kind: 'notice', title: '暂时无法加载支付信息', text: message(error), action: 'reload' })
    }
  }
  useDidShow(() => { if (!lock.current) void load() })

  const pay = async (ready: Ready, channelId: string) => {
    if (lock.current) return
    if (!ready.current()) { void load(); return }
    const alive = lifecycle.capture()
    const { source } = ready
    const isActive = () => {
      if (!ready.current()) return false
      if (source.kind === 'draft' && draftVersion() !== source.version) throw new Error('投保信息已更新，请重新核对金额后支付')
      return true
    }
    let dispatched = false
    let knownNo = source.kind === 'order' ? source.order.orderNo : undefined
    lock.current = true; setPayingId(channelId)
    try {
      if (!isActive()) return
      let request: PayRequest
      const key = source.kind === 'draft' ? creationKey(source.draft.productId) : ''
      if (source.kind === 'order') {
        const latest = await fetchOrder(source.order.orderNo)
        if (!isActive()) return
        const reason = orderActionBlockReason(latest, 'pay')
        if (reason) {
          setScreen({ kind: 'notice', title: '订单状态已更新', text: reason, action: 'detail', orderNo: latest.orderNo, restored: source.restored ? latest : undefined }); return
        }
        if (!latest.orderData || latest.productId == null || String(latest.productId) !== String(source.order.productId)) throw new Error('订单投保信息异常，请重新核对订单')
        request = { orderNo: latest.orderNo, productId: latest.productId, amount: amountYuan(latest.payAmount), subject: latest.productName || latest.productTitle || `订单 ${latest.orderNo}`, orderData: latest.orderData, channel: channelId, method: '4' }
      } else {
        request = newOrderRequest(source.draft, channelId)
      }
      if (request.amount !== ready.amount) throw new Error('应付金额已更新，请重新核对金额后支付')
      const result = await prepay(request, async content => {
        const answer = await Taro.showModal({ title: '投保业务提示', content, confirmText: '继续支付' })
        return isActive() && answer.confirm
      }, isActive, () => {
        if (key) beginCreation(key)
        dispatched = true
      }, response => {
        if (key && response?.orderNo) {
          knownNo = response.orderNo
          persistCreation(key, { state: 'known', orderNo: knownNo })
        }
      })
      if (!isActive()) return
      if (!result) {
        // A dismissed validation warning is safe to retry; an empty response after dispatch is not.
        if (dispatched) throw new Error('未能确认预支付结果')
        return
      }
      if (request.orderNo && result.orderNo !== request.orderNo) throw new Error('预支付返回的订单号不一致，已停止支付')
      const outcome = await invokePayment(result)
      if (isActive()) await Taro.redirectTo({ url: `/pages/pay-result/index?orderNo=${encodeURIComponent(result.orderNo!)}&outcome=${outcome}` })
    } catch (error) {
      if (!ready.current()) return
      if (!dispatched) setScreen({ kind: 'notice', title: '暂不能支付', text: message(error), action: 'reload' })
      else if (knownNo) setScreen({ kind: 'notice', title: '请核对订单', text: `${message(error)}。请查看订单状态后再决定是否继续支付。`, action: 'detail', orderNo: knownNo })
      else setScreen(uncertain)
    } finally {
      lock.current = false
      if (lifecycle.capture()()) { setPayingId(null); if (!alive()) void load() }
    }
  }

  const startAnother = async (order: ServerOrder) => {
    if (lock.current || !params.productId) return
    const alive = lifecycle.capture()
    if (!alive()) return
    lock.current = true; setRestarting(true)
    try {
      const key = creationKey(params.productId)
      const answer = await Taro.showModal({ title: '另填一份投保', content: '原订单仍保留在我的订单。确定重新填写，而不是继续支付这笔订单？' })
      if (!alive() || !answer.confirm) return
      releaseKnownCreation(key, order.orderNo)
      Taro.removeStorageSync(INSURANCE_DRAFT_KEY)
      await Taro.redirectTo({ url: `/pages/plan/index?productId=${encodeURIComponent(params.productId)}` })
    } catch (error) {
      if (alive()) setScreen({ kind: 'notice', title: '无法重新填写', text: message(error), action: 'orders' })
    } finally {
      lock.current = false
      if (lifecycle.capture()()) { setRestarting(false); if (!alive()) void load() }
    }
  }
  const recover = (notice: Notice) => {
    if (lock.current) return
    if (notice.action === 'reload') { void load(); return }
    if (notice.action === 'back') { void Taro.navigateBack(); return }
    void Taro.redirectTo({ url: notice.action === 'detail' && notice.orderNo ? `/pages/order-detail/index?orderNo=${encodeURIComponent(notice.orderNo)}` : '/pages/orders/index' })
  }
  const restoredLink = (order: ServerOrder) => <View className='payment-restored'>
    <Text>已找回上次创建的订单</Text>
    <Button className='payment-text-button' disabled={busy} onClick={() => startAnother(order)}>另填一份投保</Button>
  </View>

  if (screen.kind === 'loading') return <View className='payment-page'><View className='payment-state'>
    <View className='payment-spinner' /><Text className='payment-state-title'>正在获取支付信息</Text>
  </View></View>
  if (screen.kind === 'notice') return <View className='payment-page'><View className='payment-state'>
    <Text className='payment-state-mark'>!</Text><Text className='payment-state-title'>{screen.title}</Text>
    <Text className='payment-state-copy'>{screen.text}</Text>
    <Button className='payment-state-action' hoverClass='payment-hover' disabled={busy} onClick={() => recover(screen)}>{{ reload: '重新加载', orders: '查看我的订单', detail: '查看订单详情', back: '返回核对' }[screen.action]}</Button>
    {screen.restored && restoredLink(screen.restored)}
  </View></View>

  const { amount, channels, source } = screen
  const order = source.kind === 'order' ? source.order : null
  const title = source.kind === 'draft' ? source.draft.productConfig.title : source.order.productName || source.order.productTitle || '保险订单'
  return <View className='payment-page'>
    <View className='payment-receipt'>
      <View className='payment-heading'><Text className='payment-heading-title'>订单信息</Text><Text className='payment-badge'>待付款</Text></View>
      <View className='payment-total'><Text className='payment-total-label'>应付金额</Text><View className='payment-total-value'><Text className='payment-currency'>¥</Text><Text>{amount.toFixed(2)}</Text></View></View>
      <View className='payment-info'><Text className='payment-info-label'>保障产品</Text><Text className='payment-info-value'>{title}</Text></View>
      {order && <View className='payment-info'><Text className='payment-info-label'>订单编号</Text><Text className='payment-info-value payment-order-no' selectable>{order.orderNo}</Text></View>}
    </View>
    <View className='payment-actions'>
      {channels.length > 1 && <Text className='payment-channel-hint'>请选择付款方式</Text>}
      {channels.map(item => {
        const id = String(item.id)
        return <Button className='payment-primary' hoverClass='payment-hover' key={id} disabled={busy} loading={payingId === id} onClick={() => pay(screen, id)}>
          {payingId === id ? '正在发起支付…' : `${item.name?.trim() || '微信支付'} ${money(amount)}`}
        </Button>
      })}
      <Text className='payment-caption'>将在微信收银台确认付款</Text>
    </View>
    {source.kind === 'order' && source.restored && restoredLink(source.order)}
  </View>
}
