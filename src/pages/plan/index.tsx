import { Button, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useState } from 'react'

import {
  calculatePremium,
  createDefaultSelections,
  getSelectedPlan,
  INSURANCE_DRAFT_KEY,
  ProductItem,
  ProductPlan,
  productConfig,
  SelectedPlanMap
} from '../../services/product'

import './index.css'

type DetailState = { product: ProductItem; plan: ProductPlan } | null

export default function PlanPage() {
  const [selections, setSelections] = useState<SelectedPlanMap>(createDefaultSelections)
  const [detail, setDetail] = useState<DetailState>(null)
  const [noticeVisible, setNoticeVisible] = useState(false)
  const [feeVisible, setFeeVisible] = useState(false)
  const totalPremium = useMemo(() => calculatePremium(selections), [selections])

  const choosePlan = (productId: string, planId: string | null) => {
    setSelections((current) => ({ ...current, [productId]: planId }))
  }

  const chooseMorePlan = async (product: ProductItem) => {
    const extraPlans = product.plans.slice(2)
    try {
      const result = await Taro.showActionSheet({ itemList: extraPlans.map((plan) => plan.name) })
      choosePlan(product.id, extraPlans[result.tapIndex].id)
    } catch {
      // 取消选择时保留当前方案。
    }
  }

  const continueInsuring = async () => {
    const missingMainProduct = productConfig.products.find((product) => product.required && !selections[product.id])
    if (missingMainProduct) {
      Taro.showToast({ title: `请选择${missingMainProduct.name}方案`, icon: 'none' })
      return
    }

    const result = await Taro.showModal({
      title: '温馨提示',
      content: '您即将进入投保流程，请准备好投保人与学生的身份信息。',
      cancelText: '再看看',
      confirmText: '去填写',
      confirmColor: '#2d91e8'
    })
    if (!result.confirm) return

    const savedDraft = Taro.getStorageSync<{ selectedPlans?: SelectedPlanMap; formValues?: Record<string, string> }>(INSURANCE_DRAFT_KEY)
    const samePlans = productConfig.products.every((product) => savedDraft?.selectedPlans?.[product.id] === selections[product.id])
    Taro.setStorageSync(INSURANCE_DRAFT_KEY, { selectedPlans: selections, totalPremium, formValues: samePlans ? savedDraft.formValues || {} : {} })
    Taro.navigateTo({ url: '/pages/insure/index' })
  }

  return (
    <View className='plan-page'>
      <View className='plan-hero'>
        <View className='plan-hero-glow' />
        <Text className='plan-hero-title'>{productConfig.title}</Text>
        <Text className='plan-hero-subtitle'>{productConfig.subtitle}</Text>
      </View>

      <View className='product-sections'>
        {productConfig.products.map((product, productIndex) => {
          const selectedPlan = getSelectedPlan(product, selections)
          return (
            <View className='insurance-card' key={product.id}>
              <View className='insurance-heading'>
                <Text className='insurance-number'>{String(productIndex + 1).padStart(2, '0')}</Text>
                <View className='insurance-title-wrap'>
                  <Text className='insurance-title'>{product.name}</Text>
                  <Text className='insurance-company'>承保：{product.company}</Text>
                </View>
                <Text className={`insurance-type ${product.required ? '' : 'insurance-type-extra'}`}>{product.type}</Text>
              </View>

              <View className='plan-tabs'>
                {!product.required && (
                  <View className={`plan-tab ${!selectedPlan ? 'plan-tab-active' : ''}`} onClick={() => choosePlan(product.id, null)}>
                    <Text>不选</Text>
                  </View>
                )}
                {product.plans.slice(0, 2).map((plan) => (
                  <View className={`plan-tab ${selectedPlan?.id === plan.id ? 'plan-tab-active' : ''}`} key={plan.id} onClick={() => choosePlan(product.id, plan.id)}>
                    <Text>{plan.name}</Text>
                  </View>
                ))}
                {product.plans.length > 2 && <View className={`plan-tab ${selectedPlan && !product.plans.slice(0, 2).some((plan) => plan.id === selectedPlan.id) ? 'plan-tab-active' : ''}`} onClick={() => chooseMorePlan(product)}><Text>{selectedPlan && !product.plans.slice(0, 2).some((plan) => plan.id === selectedPlan.id) ? selectedPlan.name : '更多方案'}</Text></View>}
              </View>

              {selectedPlan ? (
                <View className='protection-area'>
                  {selectedPlan.protections.map((item) => (
                    <View className='protection-row' key={item.name}>
                      <Text className='protection-name'>{item.name}</Text>
                      <Text className='protection-amount'>{item.amount}</Text>
                    </View>
                  ))}
                  <View className='detail-link' onClick={() => setDetail({ product, plan: selectedPlan })}>
                    <Text>查看详情</Text><Text className='detail-arrow'>›</Text>
                  </View>
                </View>
              ) : (
                <View className='unselected-tip'>已取消选择，本险种不计入合计保费</View>
              )}
            </View>
          )
        })}

        <View className='notice-card' onClick={() => setNoticeVisible(true)}>
          <View className='notice-icon'>!</View>
          <View className='notice-copy'>
            <Text className='notice-title'>投保须知</Text>
            <Text className='notice-description'>更多请查看《学平险投保须知》</Text>
          </View>
          <Text className='notice-arrow'>›</Text>
        </View>

        <View className='service-line'>
          <Text>保险顾问服务热线：</Text>
          <Text className='service-phone' onClick={() => Taro.makePhoneCall({ phoneNumber: productConfig.servicePhone })}>400-800-0000</Text>
        </View>
      </View>

      <View className='plan-action-bar'>
        <View className='premium-area'>
          <View><Text className='currency'>¥</Text><Text className='premium-value'>{totalPremium.toFixed(2)}</Text></View>
          <Text className='premium-detail' onClick={() => setFeeVisible(true)}>查看明细 ›</Text>
        </View>
        <Button className='insure-now-button' onClick={continueInsuring}>立即投保</Button>
      </View>

      {detail && (
        <View className='sheet-mask' onClick={() => setDetail(null)}>
          <View className='detail-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='sheet-header'>
              <View>
                <Text className='sheet-title'>{detail.product.name} - {detail.plan.name}</Text>
                <Text className='sheet-subtitle'>责任保障详情</Text>
              </View>
              <View className='sheet-close' onClick={() => setDetail(null)}>×</View>
            </View>
            <ScrollView className='sheet-content' scrollY>
              <Text className='detail-summary'>{detail.plan.description}</Text>
              {detail.plan.protections.map((item) => (
                <View className='detail-item' key={item.name}>
                  <View className='detail-item-heading'><Text>{item.name}</Text><Text>{item.amount}</Text></View>
                  <Text className='detail-item-text'>{item.description}</Text>
                </View>
              ))}
            </ScrollView>
            <Button className='sheet-button' onClick={() => setDetail(null)}>我知道了</Button>
          </View>
        </View>
      )}

      {feeVisible && (
        <View className='sheet-mask' onClick={() => setFeeVisible(false)}>
          <View className='detail-sheet fee-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='sheet-title'>缴费明细</Text>
              <View className='sheet-close' onClick={() => setFeeVisible(false)}>×</View>
            </View>
            {productConfig.products.map((product) => {
              const plan = getSelectedPlan(product, selections)
              return plan ? <View className='fee-line' key={product.id}><View><Text>{product.name}</Text><Text className='fee-line-note'>{plan.name} · 全额缴纳</Text></View><Text>¥{plan.premium.toFixed(2)}</Text></View> : null
            })}
            <View className='fee-line fee-line-total'><Text>总计</Text><Text>¥{totalPremium.toFixed(2)}</Text></View>
          </View>
        </View>
      )}

      {noticeVisible && (
        <View className='sheet-mask' onClick={() => setNoticeVisible(false)}>
          <View className='detail-sheet notice-sheet' onClick={(event) => event.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='sheet-title'>学平险投保须知</Text>
              <View className='sheet-close' onClick={() => setNoticeVisible(false)}>×</View>
            </View>
            <ScrollView className='sheet-content' scrollY>
              <Text className='notice-section-title'>一、投保范围</Text>
              <Text className='notice-paragraph'>凡身体健康、能正常学习和生活的在校学生均可投保。</Text>
              <Text className='notice-section-title'>二、重要说明</Text>
              <Text className='notice-paragraph'>请如实填写投保信息。具体保险责任、责任免除、等待期及理赔要求以正式保险条款和保单为准。</Text>
              <Text className='notice-section-title'>三、信息保护</Text>
              <Text className='notice-paragraph'>身份信息仅用于投保、承保、理赔与客户服务，并按照法律法规要求进行保护。</Text>
            </ScrollView>
            <Button className='sheet-button' onClick={() => setNoticeVisible(false)}>我知道了</Button>
          </View>
        </View>
      )}
    </View>
  )
}
