import { Button, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useMemo, useState } from 'react'

import { getSelectedPlan, INSURANCE_DRAFT_KEY, INSURANCE_ORDERS_KEY, InsuranceDraft, OrderRecord, productConfig } from '../../services/product'

import './index.css'

export default function PaymentPage() {
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [draft, setDraft] = useState<InsuranceDraft | null>(null)

  useLoad((options) => {
    if (options.id) {
      const orders = Taro.getStorageSync<OrderRecord[]>(INSURANCE_ORDERS_KEY) || []
      setOrder(orders.find((item) => item.id === options.id) || null)
    } else {
      setDraft(Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY) || null)
    }
  })

  const selections = order?.selectedPlans || draft?.selectedPlans || {}
  const selectedPlans = useMemo(() => productConfig.products.flatMap((product) => {
    const plan = getSelectedPlan(product, selections)
    return plan ? [{ product, plan }] : []
  }), [selections])
  const amount = order?.totalPremium ?? draft?.totalPremium

  if (order && order.status !== '待支付' && order.status !== '支付失败') return <View className='payment-empty'>当前订单无需再次支付<Button onClick={() => Taro.navigateBack()}>返回订单详情</Button></View>
  if (amount === undefined || selectedPlans.length === 0) return <View className='payment-empty'>未找到待支付信息<Button onClick={() => Taro.navigateBack()}>返回</Button></View>

  return <View className='payment-page'>
    <View className='payment-amount'><Text>应付金额</Text><Text>¥{amount.toFixed(2)}</Text></View>
    <View className='payment-card'><Text className='payment-heading'>订单信息</Text>{order && <View className='payment-row'><Text>订单号</Text><Text>{order.id}</Text></View>}{selectedPlans.map(({ product, plan }) => <View className='payment-row' key={product.id}><Text>{product.name} · {plan.name}</Text><Text>¥{plan.premium.toFixed(2)}</Text></View>)}</View>
    <View className='payment-card'><Text className='payment-heading'>付款方式</Text><View className='payment-row'><Text>微信支付</Text><Text>✓</Text></View></View>
    <Text className='payment-tip'>请核对订单与金额后再支付。</Text>
    <Button className='payment-button' onClick={() => Taro.showToast({ title: '支付暂不可用，请稍后再试', icon: 'none' })}>确认支付</Button>
  </View>
}
