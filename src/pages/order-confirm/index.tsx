import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useMemo, useState } from 'react'

import { calculatePremium, getSelectedPlan, INSURANCE_DRAFT_KEY, InsuranceDraft, isProductConfigSnapshot } from '../../services/product'
import { buildProductUrl, decodeEntryValue } from '../../services/product-entry'

import './index.css'

function isConfirmableDraft(draft: InsuranceDraft | null | undefined, productId?: string): draft is InsuranceDraft {
  if (!productId || !draft || draft.productId !== productId || !isProductConfigSnapshot(draft.productConfig) || draft.productConfig.id !== productId) return false
  if (typeof draft.totalPremium !== 'number' || !Number.isFinite(draft.totalPremium) || draft.totalPremium < 0) return false
  if (!draft.selectedPlans || typeof draft.selectedPlans !== 'object' || Array.isArray(draft.selectedPlans) || !draft.formValues || typeof draft.formValues !== 'object' || Array.isArray(draft.formValues) || Object.values(draft.formValues).some((value) => typeof value !== 'string')) return false
  const selectedIds = Object.keys(draft.selectedPlans).filter((id) => draft.selectedPlans[id] != null)
  if (!selectedIds.length || selectedIds.some((id) => !draft.productConfig.products.some((product) => product.id === id))) return false
  try {
    const totalPremium = calculatePremium(draft.productConfig, draft.selectedPlans)
    return Number.isSafeInteger(Math.round(draft.totalPremium * 100)) && Math.round(draft.totalPremium * 100) === Math.round(totalPremium * 100)
  } catch {
    return false
  }
}

export default function OrderConfirmPage() {
  const productId = decodeEntryValue(useRouter().params.productId)
  const [detail, setDetail] = useState<'fees' | 'protections' | null>(null)
  const [draft, setDraft] = useState<InsuranceDraft | null>(null)
  const [loaded, setLoaded] = useState(false)

  useDidShow(() => {
    const storedDraft = Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY) || null
    setLoaded(true)
    if (!isConfirmableDraft(storedDraft, productId)) {
      setDraft(null)
      void Taro.reLaunch({
        url: '/pages/home/index',
        success: () => { void Taro.showToast({ title: '产品信息已失效，请重新选择', icon: 'none' }) }
      })
      return
    }
    setDraft(storedDraft)
  })

  const snapshot = draft?.productConfig
  const productConfig = isConfirmableDraft(draft, productId) && isProductConfigSnapshot(snapshot) ? snapshot : null
  const selectedProducts = useMemo(() => productConfig?.products.flatMap((product) => {
    const plan = getSelectedPlan(product, draft?.selectedPlans || {})
    return plan ? [{ product, plan }] : []
  }) || [], [draft, productConfig])

  const pay = () => {
    if (!isConfirmableDraft(draft, productId) || !selectedProducts.length) {
      void Taro.showToast({ title: '保障方案已失效，请重新选择', icon: 'none' })
      return
    }
    void Taro.navigateTo({ url: buildProductUrl('/pages/payment/index', draft.productId, draft.shareUser) })
  }

  if (!loaded) return <View className='confirm-empty ui-state'><View className='ui-state-spinner' /><Text className='ui-state-title'>正在读取订单信息</Text></View>

  if (!draft || !productConfig) {
    return <View className='confirm-empty ui-state'><View className='ui-state-mark'>!</View><Text className='ui-state-title'>产品信息已失效，请重新选择产品</Text><Button className='ui-primary-button' hoverClass='ui-button-hover' onClick={() => Taro.reLaunch({ url: '/pages/home/index' })}>返回首页</Button></View>
  }

  return (
    <View className='confirm-page'>
      <View className='confirm-status'><View className='status-dot' /><Text>信息已完成，请确认订单内容</Text></View>

      <View className='confirm-card'>
        <Text className='confirm-card-title'>{productConfig.title}</Text>
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
