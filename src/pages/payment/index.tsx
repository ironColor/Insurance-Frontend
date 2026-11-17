import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { fetchChannels, fetchOrder, fetchOrderById, invokePayment, message, money, PayChannel, prepay, ServerOrder } from '../../services/order'
import { useOrderLifecycle } from '../../hooks/use-order-lifecycle'
import { beginOrderAction, orderActionBlockReason, pendingBlockReason } from '../../services/order-safety'
import './index.css'

export default function PaymentPage() {
  const params = useRouter().params
  const [order, setOrder] = useState<ServerOrder | null>(null)
  const [channels, setChannels] = useState<PayChannel[]>([])
  const [channel, setChannel] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const lifecycle = useOrderLifecycle()
  const sequence = useRef(0)
  const blockReason = order ? orderActionBlockReason(order, 'pay') || pendingBlockReason(order.orderNo, 'pay') : ''
  const load = async () => {
    const alive = lifecycle.capture()
    if (!alive()) return
    const ticket = ++sequence.current
    const isActive = () => alive() && ticket === sequence.current
    setError(''); setOrder(null); setChannels([]); setChannel('')
    if (!params.orderNo && !params.id) {
      setError('暂不能创建新订单：最新接口仅定义 orderData 为字符串，尚未提供投保字段与方案的序列化结构。请联系服务方确认，当前不会提交猜测数据或扣款。')
      return
    }
    try {
      const value = params.orderNo ? await fetchOrder(params.orderNo) : await fetchOrderById(params.id!)
      if (!isActive()) return
      setOrder(value)
      if (value.productId == null) throw new Error('订单未返回产品标识')
      const available = await fetchChannels(value.productId)
      if (isActive()) setChannels(available)
    } catch (error) { if (isActive()) setError(message(error)) }
  }
  useDidShow(() => { if (!lock.current) void load() })
  const pay = async () => {
    const isActive = lifecycle.capture()
    if (!isActive() || !order || !channel || lock.current) return
    if (blockReason) { setError(blockReason); return }
    lock.current = true; setBusy(true); setError('')
    let orderNo = order.orderNo
    try {
      const latest = await fetchOrder(orderNo)
      if (!isActive()) return
      setOrder(latest)
      const reason = orderActionBlockReason(latest, 'pay') || pendingBlockReason(orderNo, 'pay')
      if (reason) throw new Error(reason)
      if (latest.expireTime && Number.isFinite(Date.parse(latest.expireTime)) && Date.parse(latest.expireTime) <= Date.now()) throw new Error('订单已超过服务端有效期')
      if (typeof latest.totalAmount !== 'number' || !Number.isFinite(latest.totalAmount) || latest.totalAmount < 0) throw new Error('服务端未返回有效订单金额')
      if (latest.discountAmount != null && latest.discountAmount !== 0) throw new Error('该订单含优惠，文档尚未明确最终应付字段，请联系客服核实后支付')
      // Once prepay may have reached the server, do not blindly retry an uncertain write.
      beginOrderAction(orderNo, 'pay')
      const result = await prepay({ orderId: latest.orderId, orderNo, productId: latest.productId, amount: latest.totalAmount, subject: latest.productName || latest.productTitle || `订单 ${orderNo}`, orderData: latest.orderData, channel, method: '4' }, async content => {
        if (!isActive()) return false
        const answer = await Taro.showModal({ title: '投保业务提示', content, confirmText: '继续支付' })
        return isActive() && answer.confirm
      }, isActive)
      if (!isActive() || !result) return
      if (result.orderNo && result.orderNo !== orderNo) throw new Error('预支付订单号与当前订单不一致，已停止调用微信支付')
      orderNo = result.orderNo || orderNo
      const outcome = await invokePayment(result)
      if (!isActive()) return
      await Taro.redirectTo({ url: `/pages/pay-result/index?orderNo=${encodeURIComponent(orderNo)}&outcome=${outcome}` })
    } catch (error) { if (isActive()) setError(`${message(error)}。请先查询订单确认结果，不要重复提交。`) }
    finally { if (isActive()) { lock.current = false; setBusy(false) } }
  }
  return <View className='payment-page'>
    {error && <View className='payment-card'>{error}</View>}
    {order && <><View className='payment-amount'><Text>服务端订单金额</Text><Text>{money(order.totalAmount)}</Text></View><View className='payment-card'>订单号：{order.orderNo}</View>
      <View className='payment-card'><Text>请选择服务端支付渠道（小程序支付）</Text>{channels.map(item => <Button key={String(item.id)} disabled={busy} onClick={() => setChannel(String(item.id))}>{channel === String(item.id) ? '✓ ' : ''}{item.name || item.code || item.id}</Button>)}{!channels.length && <Text>暂无可用渠道</Text>}</View>
      <Text>微信支付回调不代表订单已到账，完成后将查询服务端结果。</Text>
      {blockReason && <View>{blockReason}</View>}
      <Button disabled={busy || !channel || !!blockReason} loading={busy} onClick={pay}>校验并支付</Button></>}
    <Button disabled={busy} onClick={() => Taro.redirectTo({ url: '/pages/orders/index' })}>查询我的订单</Button>
  </View>
}
