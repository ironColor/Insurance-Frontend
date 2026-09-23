import { Button, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'

import { getSelectedPlan, INSURANCE_ORDERS_KEY, OrderRecord, productConfig } from '../../services/product'

import './index.css'

const mask = (value: string, start: number, end: number) => value.length > start + end ? `${value.slice(0, start)}${'*'.repeat(value.length - start - end)}${value.slice(-end)}` : value

export default function OrderDetailPage() {
  const [order, setOrder] = useState<OrderRecord | null>(null)
  useLoad((options) => {
    const orders = Taro.getStorageSync<OrderRecord[]>(INSURANCE_ORDERS_KEY) || []
    setOrder(orders.find((item) => item.id === options.id) || null)
  })

  if (!order) return <View className='detail-empty'>未找到订单<Button onClick={() => Taro.navigateBack()}>返回订单列表</Button></View>

  const selected = productConfig.products.flatMap((product) => {
    const plan = getSelectedPlan(product, order.selectedPlans)
    return plan ? [{ product, plan }] : []
  })

  return (
    <View className='order-detail-page'>
      <View className='order-detail-status'><Text>{order.status}</Text><Text>订单号 {order.id}</Text></View>
      <View className='order-detail-card'>
        <Text className='order-detail-title'>已选保障方案</Text>
        {selected.map(({ product, plan }) => <View className='order-detail-plan' key={product.id}>
          <View className='order-detail-line prominent'><Text>{product.name} · {plan.name}</Text><Text>¥{plan.premium.toFixed(2)}</Text></View>
          <View className='order-detail-line'><Text>承保公司</Text><Text>{product.company}</Text></View>
          <View className='order-detail-line'><Text>缴费方式</Text><Text>全额缴纳</Text></View>
          <View className='order-detail-line'><Text>保障期间</Text><Text>以正式保单为准</Text></View>
          {plan.protections.map((item) => <View className='order-detail-line' key={item.name}><Text>{item.name}</Text><Text>{item.amount}</Text></View>)}
        </View>)}
      </View>
      {productConfig.fieldGroups.map((group) => <View className='order-detail-card' key={group.id}>
        <Text className='order-detail-title'>{group.name}</Text>
        {group.fields.filter((field) => order.formValues[field.id]).map((field) => {
          const value = order.formValues[field.id]
          return <View className='order-detail-line' key={field.id}><Text>{field.name}</Text><Text>{field.type === '身份证' ? mask(value, 4, 4) : field.type === '手机' ? mask(value, 3, 4) : value}</Text></View>
        })}
      </View>)}
      <View className='order-detail-card'>
        <Text className='order-detail-title'>订单信息</Text>
        <View className='order-detail-line'><Text>订单号</Text><Text>{order.id}</Text></View>
        <View className='order-detail-line'><Text>下单时间</Text><Text>{order.createdAt}</Text></View>
        {order.paidAt && <View className='order-detail-line'><Text>支付时间</Text><Text>{order.paidAt}</Text></View>}
        <View className='order-detail-line prominent'><Text>保费合计</Text><Text>¥{order.totalPremium.toFixed(2)}</Text></View>
      </View>
      {order.status === '已支付' && <Button className='order-detail-action' onClick={() => Taro.navigateTo({ url: `/pages/refund-apply/index?id=${encodeURIComponent(order.id)}` })}>申请退保</Button>}
      {(order.status === '待支付' || order.status === '支付失败') && <Button className='order-detail-action' onClick={() => Taro.navigateTo({ url: `/pages/payment/index?id=${encodeURIComponent(order.id)}` })}>继续支付</Button>}
      {(order.status === '退款中' || order.status === '退款完成') && <Button className='order-detail-action' onClick={() => Taro.navigateTo({ url: `/pages/refund-status/index?id=${encodeURIComponent(order.id)}` })}>查看退款进度</Button>}
    </View>
  )
}
