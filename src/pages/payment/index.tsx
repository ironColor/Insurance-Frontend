import { Button, Text, View } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useMemo, useState } from 'react'

import { calculatePremium, getSelectedPlan, INSURANCE_DRAFT_KEY, INSURANCE_ORDERS_KEY, InsuranceDraft, isProductConfigSnapshot, OrderRecord } from '../../services/product'
import { decodeEntryValue } from '../../services/product-entry'

import './index.css'

export default function PaymentPage() {
  const productId = decodeEntryValue(useRouter().params.productId)
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [draft, setDraft] = useState<InsuranceDraft | null>(null)
  const [fromOrder, setFromOrder] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useLoad((options) => {
    setLoaded(true)
    setFromOrder(Boolean(options.id))
    if (options.id) {
      const orders = Taro.getStorageSync<OrderRecord[]>(INSURANCE_ORDERS_KEY) || []
      setOrder(orders.find((item) => item.id === options.id) || null)
    } else {
      const storedDraft = Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY) || null
      if (!productId || storedDraft?.productId !== productId || !isProductConfigSnapshot(storedDraft.productConfig) || storedDraft.productConfig.id !== productId) {
        void Taro.reLaunch({
          url: '/pages/home/index',
          success: () => { void Taro.showToast({ title: '产品信息已失效，请重新选择', icon: 'none' }) }
        })
        return
      }
      setDraft(storedDraft)
    }
  })

  const snapshot = fromOrder ? order?.productConfig : draft?.productConfig
  const productConfig = isProductConfigSnapshot(snapshot) && (fromOrder ? !order?.productId || snapshot.id === order.productId : Boolean(productId && draft?.productId === productId && snapshot.id === productId)) ? snapshot : null
  const selections = (fromOrder ? order?.selectedPlans : draft?.selectedPlans) || {}
  const amount = fromOrder ? order?.totalPremium : draft?.totalPremium
  const selectedPlans = useMemo(() => {
    if (!productConfig || typeof selections !== 'object' || Array.isArray(selections) || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return []
    const selectedIds = Object.keys(selections).filter((id) => selections[id] != null)
    if (!selectedIds.length || selectedIds.some((id) => !productConfig.products.some((product) => product.id === id))) return []
    try {
      const totalPremium = calculatePremium(productConfig, selections)
      if (!Number.isSafeInteger(Math.round(amount * 100)) || Math.round(amount * 100) !== Math.round(totalPremium * 100)) return []
      return productConfig.products.flatMap((product) => {
        const plan = getSelectedPlan(product, selections)
        return plan ? [{ product, plan }] : []
      })
    } catch {
      return []
    }
  }, [amount, productConfig, selections])

  if (!loaded) return <View className='payment-empty'>正在读取支付信息</View>
  if (fromOrder && !order) return <View className='payment-empty'>未找到待支付订单<Button onClick={() => Taro.redirectTo({ url: '/pages/orders/index' })}>返回订单列表</Button></View>
  if (order && order.status !== '待支付' && order.status !== '支付失败') return <View className='payment-empty'>当前订单无需再次支付<Button onClick={() => Taro.navigateBack()}>返回订单详情</Button></View>
  if (!productConfig) return <View className='payment-empty'>{fromOrder ? '订单产品配置缺失，暂时无法支付' : '产品信息已失效，请重新选择产品'}<Button onClick={() => fromOrder ? Taro.redirectTo({ url: '/pages/orders/index' }) : Taro.reLaunch({ url: '/pages/home/index' })}>{fromOrder ? '返回订单列表' : '返回首页'}</Button></View>
  if (typeof amount !== 'number' || !Number.isFinite(amount) || selectedPlans.length === 0) return <View className='payment-empty'>保费或保障方案已失效，请重新选择产品<Button onClick={() => fromOrder ? Taro.redirectTo({ url: '/pages/orders/index' }) : Taro.reLaunch({ url: '/pages/home/index' })}>{fromOrder ? '返回订单列表' : '返回首页'}</Button></View>

  return <View className='payment-page'>
    <View className='payment-amount'><Text>应付金额</Text><Text>¥{amount.toFixed(2)}</Text></View>
    <View className='payment-card'><Text className='payment-heading'>{productConfig.title}</Text>{order && <View className='payment-row'><Text>订单号</Text><Text>{order.id}</Text></View>}{selectedPlans.map(({ product, plan }) => <View className='payment-row' key={product.id}><Text>{product.name} · {plan.name}</Text><Text>¥{plan.premium.toFixed(2)}</Text></View>)}</View>
    <View className='payment-card'><Text className='payment-heading'>付款方式</Text><View className='payment-row'><Text>微信支付</Text><Text>✓</Text></View></View>
    <Text className='payment-tip'>请核对订单与金额后再支付。</Text>
    <Button className='payment-button' onClick={() => Taro.showToast({ title: '支付暂不可用，请稍后再试', icon: 'none' })}>确认支付</Button>
  </View>
}
