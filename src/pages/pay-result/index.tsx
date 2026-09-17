import { Button, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'

import { INSURANCE_DRAFT_KEY, INSURANCE_ORDERS_KEY, InsuranceDraft, OrderRecord } from '../../services/product'

import './index.css'

export default function PayResultPage() {
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [success, setSuccess] = useState(true)

  useLoad((options) => {
    const isSuccess = options.status !== 'failed'
    setSuccess(isSuccess)
    const draft = Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY)
    if (!draft) return
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    const createdAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    const record: OrderRecord = {
      id: `BX${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${String(now.getTime()).slice(-8)}`,
      createdAt,
      paidAt: isSuccess ? createdAt : undefined,
      status: isSuccess ? '已支付' : '支付失败',
      totalPremium: draft.totalPremium,
      selectedPlans: draft.selectedPlans,
      formValues: draft.formValues
    }
    const orders = Taro.getStorageSync<OrderRecord[]>(INSURANCE_ORDERS_KEY) || []
    Taro.setStorageSync(INSURANCE_ORDERS_KEY, [record, ...orders.filter((item) => item.id !== record.id)])
    setOrder(record)
  })

  return (
    <View className='result-page'>
      <View className={`result-icon ${success ? 'result-success' : 'result-failed'}`}>{success ? '✓' : '!'}</View>
      <Text className='result-title'>{success ? '支付成功' : '支付失败'}</Text>
      <Text className='result-description'>{success ? '订单已支付完成，保险公司将按流程生成投保凭证。' : '本次支付未完成，请查询订单状态后重试。'}</Text>
      <View className='result-card'>
        <View className='result-row'><Text>订单编号</Text><Text>{order?.id || '生成中'}</Text></View>
        <View className='result-row'><Text>订单金额</Text><Text>¥{order?.totalPremium.toFixed(2) || '0.00'}</Text></View>
        <View className='result-row'><Text>支付方式</Text><Text>微信支付</Text></View>
        <View className='result-row'><Text>{success ? '支付时间' : '创建时间'}</Text><Text>{order?.paidAt || order?.createdAt || '-'}</Text></View>
        <View className='result-row'><Text>被保险人</Text><Text>{order?.formValues['student-name'] || '-'}</Text></View>
      </View>
      <Button className='result-primary' onClick={() => Taro.redirectTo({ url: '/pages/orders/index' })}>查看我的订单</Button>
      <Button className='result-secondary' onClick={() => Taro.reLaunch({ url: '/pages/home/index' })}>返回首页</Button>
    </View>
  )
}
