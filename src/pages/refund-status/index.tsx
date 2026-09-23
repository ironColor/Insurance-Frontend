import { Button, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'

import { INSURANCE_ORDERS_KEY, OrderRecord } from '../../services/product'

import './index.css'

export default function RefundStatusPage() {
  const [order, setOrder] = useState<OrderRecord | null>(null)
  useLoad((options) => {
    const orders = Taro.getStorageSync<OrderRecord[]>(INSURANCE_ORDERS_KEY) || []
    setOrder(orders.find((item) => item.id === options.id && (item.status === '退款中' || item.status === '退款完成')) || null)
  })
  if (!order) return <View className='refund-status-empty'>暂无退款信息<Button onClick={() => Taro.navigateBack()}>返回</Button></View>
  const complete = order.status === '退款完成'
  return <View className='refund-status-page'>
    <View className='refund-status-hero'><Text>{complete ? '退款已完成' : '退款处理中'}</Text><Text>{complete ? '退款结果请以实际到账金额为准' : '退款申请正在处理，请留意退款通知'}</Text></View>
    <View className='refund-status-card'><Text>退款信息</Text><View><Text>退款方式</Text><Text>原路返回</Text></View><View><Text>退款账户</Text><Text>原支付账户</Text></View><View><Text>退款金额</Text><Text>以审核结果为准</Text></View></View>
    <View className='refund-status-card'><Text>订单信息</Text><View><Text>订单号</Text><Text>{order.id}</Text></View><View><Text>原订单保费</Text><Text>¥{order.totalPremium.toFixed(2)}</Text></View></View>
    <Button onClick={() => Taro.navigateBack()}>返回</Button>
  </View>
}
