import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useOrder } from '../../hooks/use-order'
import { money, orderStatus } from '../../services/order'
import { orderActionBlockReason } from '../../services/order-safety'
import './index.css'

export default function OrderDetailPage() {
  const { order, error, loading, reload } = useOrder()
  const navigate = (page: string) => order && Taro.navigateTo({ url: `/pages/${page}/index?orderNo=${encodeURIComponent(order.orderNo)}` })
  if (!order) return <View className='detail-empty'>{loading ? '正在查询订单' : error}<Button onClick={reload} disabled={loading}>重新查询</Button></View>
  return <View className='order-detail-page'>
    <View className='order-detail-status'><Text>{orderStatus(order)}</Text><Text>订单号 {order.orderNo}</Text></View>
    <View className='order-detail-card'>
      <Text className='order-detail-title'>{order.productName || order.productTitle}</Text>
      <View>订单金额：{money(order.totalAmount)}</View><View>应付/已付金额：{money(order.payAmount)}</View>
      <View>下单时间：{order.createTime || '未返回'}</View><View>支付时间：{order.payTime || '未返回'}</View>
      <View>支付成功不代表保险公司已承保，本期未对接保险公司出单。</View>
      <View>生效时间：{order.policyEffectiveDate || '待确认'}</View>
    </View>
    {!orderActionBlockReason(order, 'pay') && <Button onClick={() => navigate('payment')}>继续支付</Button>}
    {!orderActionBlockReason(order, 'refund') && <Button onClick={() => navigate('refund-apply')}>申请退款（服务端审核）</Button>}
    <Button onClick={() => navigate('refund-status')}>查询退款记录</Button>
    <Button disabled={loading} onClick={reload}>刷新订单</Button>
  </View>
}
