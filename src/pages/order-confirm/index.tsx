import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useState } from 'react'

import { getSelectedPlan, INSURANCE_DRAFT_KEY, InsuranceDraft, productConfig } from '../../services/product'

import './index.css'

export default function OrderConfirmPage() {
  const [paying, setPaying] = useState(false)
  const draft = Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY)
  const selectedProducts = useMemo(() => productConfig.products.flatMap((product) => {
    const plan = getSelectedPlan(product, draft?.selectedPlans || {})
    return plan ? [{ product, plan }] : []
  }), [draft?.selectedPlans])

  const pay = () => {
    if (paying) return
    setPaying(true)
    setTimeout(() => {
      Taro.redirectTo({ url: '/pages/pay-result/index?status=success' })
    }, 700)
  }

  if (!draft) {
    return <View className='confirm-empty'><Text>未找到待确认订单</Text><Button onClick={() => Taro.reLaunch({ url: '/pages/home/index' })}>返回首页</Button></View>
  }

  return (
    <View className='confirm-page'>
      <View className='confirm-status'><View className='status-dot' /><Text>信息已完成，请确认订单内容</Text></View>

      <View className='confirm-card'>
        <Text className='confirm-card-title'>巴中市学生保险保障</Text>
        {selectedProducts.map(({ product, plan }) => (
          <View className='plan-summary' key={product.id}>
            <View className='plan-summary-head'><Text>{product.name}</Text><Text className='plan-summary-price'>¥{plan.premium.toFixed(2)}</Text></View>
            <View className='summary-row'><Text>产品名称</Text><Text>{product.name}</Text></View>
            <View className='summary-row'><Text>承保公司</Text><Text>{product.company}</Text></View>
            <View className='summary-row'><Text>保障计划</Text><Text>{plan.name}</Text></View>
            <View className='summary-row'><Text>缴费方式</Text><Text>全额缴纳</Text></View>
            <View className='summary-row'><Text>保障期间</Text><Text>支付次日零时起一年</Text></View>
          </View>
        ))}
      </View>

      {productConfig.fieldGroups.map((group) => (
        <View className='confirm-card info-card' key={group.id}>
          <Text className='confirm-card-title'>{group.name}</Text>
          {group.fields.filter((field) => draft.formValues[field.id]).map((field) => (
            <View className='summary-row' key={field.id}>
              <Text>{field.name}</Text>
              <Text className='summary-value'>{field.type === '身份证' ? `${draft.formValues[field.id].slice(0, 4)}**********${draft.formValues[field.id].slice(-4)}` : field.type === '手机' ? `${draft.formValues[field.id].slice(0, 3)}****${draft.formValues[field.id].slice(-4)}` : draft.formValues[field.id]}</Text>
            </View>
          ))}
        </View>
      ))}

      <View className='confirm-tip'>请确认投保人、被保险人与方案信息无误。支付结果以服务端和支付渠道最终状态为准。</View>

      <View className='confirm-action-bar'>
        <View className='confirm-total'><Text className='confirm-currency'>¥</Text><Text>{draft.totalPremium.toFixed(2)}</Text><Text className='confirm-detail'>共 {selectedProducts.length} 项</Text></View>
        <Button className='pay-button' loading={paying} disabled={paying} onClick={pay}>{paying ? '正在创建订单' : '立即支付'}</Button>
      </View>
    </View>
  )
}
