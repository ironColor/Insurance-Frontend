import { Button, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'

import { INSURANCE_ORDERS_KEY, OrderRecord } from '../../services/product'

import './index.css'

export default function PayResultPage() {
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [status, setStatus] = useState<'success' | 'failed' | 'unknown'>('unknown')

  useLoad((options) => {
    const orders = Taro.getStorageSync<OrderRecord[]>(INSURANCE_ORDERS_KEY) || []
    const matched = orders.find((item) => item.id === options.id)
    setOrder(matched || null)
    setStatus(matched?.status === '已支付' ? 'success' : matched?.status === '支付失败' ? 'failed' : 'unknown')
  })

  const success = status === 'success'
  const unknown = status === 'unknown'

  return (
    <View className='result-page'>
      <View className={`result-icon ${success ? 'result-success' : 'result-failed'}`}>{success ? '✓' : '?'}</View>
      <Text className='result-title'>{success ? '支付成功' : unknown ? '支付结果待确认' : '支付失败'}</Text>
      <Text className='result-description'>{success ? '订单已支付完成。' : unknown ? '暂未查询到明确的支付结果，请从订单列表查看最新状态。' : '本次支付未完成，请查询订单状态后重试。'}</Text>
      {order && <View className='result-card'>
        <View className='result-row'><Text>订单编号</Text><Text>{order?.id || '生成中'}</Text></View>
        <View className='result-row'><Text>订单金额</Text><Text>¥{order?.totalPremium.toFixed(2) || '0.00'}</Text></View>
        <View className='result-row'><Text>支付方式</Text><Text>微信支付</Text></View>
        <View className='result-row'><Text>{success ? '支付时间' : '创建时间'}</Text><Text>{order?.paidAt || order?.createdAt || '-'}</Text></View>
        <View className='result-row'><Text>被保险人</Text><Text>{order?.formValues['student-name'] || '-'}</Text></View>
      </View>}
      <Button className='result-primary' onClick={() => Taro.redirectTo({ url: '/pages/orders/index' })}>查看我的订单</Button>
      <Button className='result-secondary' onClick={() => Taro.reLaunch({ url: '/pages/home/index' })}>返回首页</Button>
    </View>
  )
}
