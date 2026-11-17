import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useRef, useState } from 'react'
import { useOrder } from '../../hooks/use-order'
import { cancelOrder, fetchOrder, message, money, orderStatus } from '../../services/order'
import { useOrderLifecycle } from '../../hooks/use-order-lifecycle'
import { beginOrderAction, orderActionBlockReason, pendingBlockReason } from '../../services/order-safety'
import './index.css'

export default function OrderDetailPage() {
  const { order, error, loading, reload } = useOrder()
  const lock = useRef(false)
  const lifecycle = useOrderLifecycle()
  const cancelReason = order ? orderActionBlockReason(order, 'cancel') || pendingBlockReason(order.orderNo, 'cancel') : ''
  const [busy, setBusy] = useState(false)
  const navigate = (page: string) => order && Taro.navigateTo({ url: `/pages/${page}/index?orderNo=${encodeURIComponent(order.orderNo)}` })
  const cancel = async () => {
    const isActive = lifecycle.capture()
    if (!isActive() || !order || lock.current || cancelReason) return
    lock.current = true; setBusy(true)
    try {
      const latest = await fetchOrder(order.orderNo)
      if (!isActive()) return
      const reason = orderActionBlockReason(latest, 'cancel') || pendingBlockReason(order.orderNo, 'cancel')
      if (reason) throw new Error(reason)
      const answer = await Taro.showModal({ title: '取消订单', content: '仅未支付订单可取消，由服务端校验。确定取消？' })
      if (!isActive() || !answer.confirm) return
      beginOrderAction(order.orderNo, 'cancel')
      await cancelOrder(order.orderNo)
      if (!isActive()) return
      await reload()
    } catch (error) { if (isActive()) await Taro.showModal({ title: '取消结果待确认', content: `${message(error)}；请刷新订单，勿重复操作。`, showCancel: false }) }
    finally { if (isActive()) { lock.current = false; setBusy(false) } }
  }
  if (!order) return <View className='detail-empty'>{loading ? '正在查询订单' : error}<Button onClick={reload} disabled={loading}>重新查询</Button></View>
  return <View className='order-detail-page'>
    <View className='order-detail-status'><Text>{orderStatus(order)}</Text><Text>订单号 {order.orderNo}</Text></View>
    <View className='order-detail-card'>
      <Text className='order-detail-title'>{order.productName || order.productTitle}</Text>
      <View>订单金额：{money(order.totalAmount)}</View><View>实付金额：{money(order.payAmount)}</View>
      <View>下单时间：{order.createTime || '未返回'}</View><View>支付时间：{order.payTime || '未返回'}</View>
      <View>保单号：{order.policyNo || '未返回'}</View><View>保单状态：{order.policyStatus || '未返回'}</View>
      <View>保障期间：{order.policyEffectiveDate || '待确认'} 至 {order.policyExpiryDate || '待确认'}</View>
    </View>
    <View>状态字典尚未提供，当前显示服务端原始状态。</View>
    <View>{orderActionBlockReason(order, 'pay')}</View>
    <Button disabled={busy || !!orderActionBlockReason(order, 'pay')} onClick={() => navigate('payment')}>查询支付条件</Button>
    <Button disabled={busy || !!cancelReason} onClick={cancel}>申请取消未支付订单</Button>
    <Button disabled={busy || !!orderActionBlockReason(order, 'refund')} onClick={() => navigate('refund-apply')}>申请退款（服务端审核）</Button>
    <Button onClick={() => navigate('refund-status')}>查询退款记录</Button>
    <Button disabled={loading || busy} onClick={reload}>刷新订单</Button>
  </View>
}
