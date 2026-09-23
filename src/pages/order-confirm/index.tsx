import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useState } from 'react'

import { getSelectedPlan, INSURANCE_DRAFT_KEY, InsuranceDraft, productConfig } from '../../services/product'

import './index.css'

export default function OrderConfirmPage() {
  const [detail, setDetail] = useState<'fees' | 'protections' | null>(null)
  const draft = Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY)
  const selectedProducts = useMemo(() => productConfig.products.flatMap((product) => {
    const plan = getSelectedPlan(product, draft?.selectedPlans || {})
    return plan ? [{ product, plan }] : []
  }), [draft?.selectedPlans])

  const pay = () => Taro.navigateTo({ url: '/pages/payment/index' })

  if (!draft) {
    return <View className='confirm-empty'><Text>未找到待确认订单</Text><Button onClick={() => Taro.reLaunch({ url: '/pages/home/index' })}>返回首页</Button></View>
  }

  return (
    <View className='confirm-page'>
      <View className='confirm-status'><View className='status-dot' /><Text>信息已完成，请确认订单内容</Text></View>

      <View className='confirm-card'>
        <Text className='confirm-card-title'>学生保险保障方案</Text>
        {selectedProducts.map(({ product, plan }) => (
          <View className='plan-summary' key={product.id}>
            <View className='plan-summary-head'><Text>{product.name}</Text><Text className='plan-summary-price'>¥{plan.premium.toFixed(2)}</Text></View>
            <View className='summary-row'><Text>产品名称</Text><Text>{product.name}</Text></View>
            <View className='summary-row'><Text>承保公司</Text><Text>{product.company}</Text></View>
            <View className='summary-row'><Text>保障计划</Text><Text>{plan.name}</Text></View>
            <View className='summary-row'><Text>缴费方式</Text><Text>全额缴纳</Text></View>
            <View className='summary-row'><Text>保障期间</Text><Text>以正式保单为准</Text></View>
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

      <View className='confirm-links'>
        <Text onClick={() => setDetail('fees')}>查看明细 ›</Text>
        <Text onClick={() => setDetail('protections')}>查看保障责任 ›</Text>
      </View>
      <View className='confirm-tip'>请确认投保人、被保险人与方案信息无误。</View>

      <View className='confirm-action-bar'>
        <View className='confirm-total'><Text className='confirm-currency'>¥</Text><Text>{draft.totalPremium.toFixed(2)}</Text><Text className='confirm-detail'>共 {selectedProducts.length} 项</Text></View>
        <Button className='pay-button' onClick={pay}>立即支付</Button>
      </View>

      {detail && (
        <View className='confirm-overlay' onClick={() => setDetail(null)}>
          <View className='confirm-detail-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='confirm-sheet-header'><Text>{detail === 'fees' ? '缴费明细' : '保障责任'}</Text><Text onClick={() => setDetail(null)}>×</Text></View>
            {selectedProducts.map(({ product, plan }) => (
              <View className='confirm-sheet-group' key={product.id}>
                <Text className='confirm-sheet-product'>{product.name} · {plan.name}</Text>
                {detail === 'fees' ? <View className='confirm-sheet-line'><Text>全额缴纳</Text><Text>¥{plan.premium.toFixed(2)}</Text></View> : plan.protections.map((item) => <View className='confirm-sheet-line' key={item.name}><Text>{item.name}</Text><Text>{item.amount}</Text></View>)}
              </View>
            ))}
            {detail === 'fees' && <View className='confirm-sheet-total'><Text>总计</Text><Text>¥{draft.totalPremium.toFixed(2)}</Text></View>}
          </View>
        </View>
      )}
    </View>
  )
}
