import { Button, RichText, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useState } from 'react'

import {
  calculatePremium,
  createDefaultSelections,
  getSelectedPlan,
  INSURANCE_DRAFT_KEY,
  InsuranceDraft,
  ProductItem,
  ProductPlan,
  ProductConfig,
  SelectedPlanMap
} from '../../services/product'

import { useProductConfig } from '../../hooks/use-product'
import { buildProductUrl } from '../../services/product-entry'
import { openProductDocument } from '../../services/product-document'

import './index.css'

type DetailState = { product: ProductItem; plan: ProductPlan } | null

export default function PlanPage() {
  const { config, loading, error, reload, shareUser } = useProductConfig()
  if (!config) return <View className='plan-page product-load-state ui-state'>
    <View className={loading ? 'ui-state-spinner' : 'ui-state-mark'}>{loading ? '' : '!'}</View>
    <Text className='ui-state-title'>{loading ? '正在加载产品方案…' : '产品方案暂时无法加载'}</Text>
    {!loading && <><Text className='ui-state-copy'>{error || '产品信息暂不可用，请稍后重试'}</Text><Button className='ui-primary-button' hoverClass='ui-button-hover' onClick={reload}>重新加载</Button></>}
  </View>
  return <PlanContent key={config.id} productConfig={config} shareUser={shareUser} />
}

function PlanContent({ productConfig, shareUser }: { productConfig: ProductConfig; shareUser?: string }) {
  const [selections, setSelections] = useState<SelectedPlanMap>(() => createDefaultSelections(productConfig))
  const [detail, setDetail] = useState<DetailState>(null)
  const [morePlans, setMorePlans] = useState<ProductItem | null>(null)
  const [noticeVisible, setNoticeVisible] = useState(false)
  const [feeVisible, setFeeVisible] = useState(false)
  const totalPremium = useMemo(() => calculatePremium(productConfig, selections), [productConfig, selections])

  const choosePlan = (productId: string, planId: string | null) => {
    setSelections((current) => ({ ...current, [productId]: planId }))
  }

  const continueInsuring = async () => {
    const missingMainProduct = productConfig.products.find((product) => product.required && !selections[product.id])
    if (missingMainProduct) {
      Taro.showToast({ title: `请选择${missingMainProduct.name}方案`, icon: 'none' })
      return
    }

    if (!productConfig.products.some((product) => getSelectedPlan(product, selections))) {
      Taro.showToast({ title: '请至少选择一项保障方案', icon: 'none' })
      return
    }
    const result = await Taro.showModal({
      title: '温馨提示',
      content: '您即将进入投保流程，请准备好投保人与被保险人的身份信息。',
      cancelText: '再看看',
      confirmText: '去填写',
      confirmColor: '#2d91e8'
    })
    if (!result.confirm) return

    const savedDraft = Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY)
    const validSavedValues = savedDraft?.formValues && typeof savedDraft.formValues === 'object' && !Array.isArray(savedDraft.formValues) && Object.values(savedDraft.formValues).every((value) => typeof value === 'string')
    const samePlans = validSavedValues && savedDraft?.productId === productConfig.id && productConfig.products.every((product) => savedDraft.selectedPlans?.[product.id] === selections[product.id])
    const draft: InsuranceDraft = { productId: productConfig.id, productConfig, shareUser, selectedPlans: selections, totalPremium, formValues: samePlans ? savedDraft.formValues || {} : {} }
    Taro.setStorageSync(INSURANCE_DRAFT_KEY, draft)
    Taro.navigateTo({ url: buildProductUrl('/pages/insure/index', productConfig.id, shareUser) })
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
                <Text className='insurance-title'>{product.name}</Text>
                <View className='insurance-heading-meta'>
                  <Text className={`insurance-type ${product.required ? '' : 'insurance-type-extra'}`}>{product.type}</Text>
                  <Text className='insurance-company'>承保：{product.company}</Text>
                </View>
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
                {product.plans.length > 2 && <View className={`plan-tab ${selectedPlan && !product.plans.slice(0, 2).some((plan) => plan.id === selectedPlan.id) ? 'plan-tab-active' : ''}`} onClick={() => setMorePlans(product)}><Text>{selectedPlan && !product.plans.slice(0, 2).some((plan) => plan.id === selectedPlan.id) ? selectedPlan.name : '更多方案'}</Text></View>}
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

        {productConfig.forceRead.length > 0 && <View className='notice-card' onClick={() => setNoticeVisible(true)}>
          <View className='notice-icon'>!</View>
          <View className='notice-copy'>
            <Text className='notice-title'>投保须知</Text>
            <Text className='notice-description'>查看本产品投保须知与阅读文件</Text>
          </View>
          <Text className='notice-arrow'>›</Text>
        </View>}

        {productConfig.servicePhone && <View className='service-line'>
          <Text>保险顾问服务热线：</Text>
          <Text className='service-phone' onClick={() => Taro.makePhoneCall({ phoneNumber: productConfig.servicePhone })}>{productConfig.servicePhone}</Text>
        </View>}
      </View>

      <View className='plan-action-bar'>
        <View className='premium-area'>
          <View><Text className='currency'>¥</Text><Text className='premium-value'>{totalPremium.toFixed(2)}</Text></View>
          <Text className='premium-detail' onClick={() => setFeeVisible(true)}>查看明细 ›</Text>
        </View>
        <Button className='insure-now-button' onClick={continueInsuring}>立即投保</Button>
      </View>

      {morePlans && <View className='sheet-mask' onClick={() => setMorePlans(null)}>
        <View className='detail-sheet' onClick={(event) => event.stopPropagation()}>
          <View className='sheet-header'><Text className='sheet-title'>{morePlans.name} · 更多方案</Text><View className='sheet-close' onClick={() => setMorePlans(null)}>×</View></View>
          <ScrollView className='sheet-content' scrollY>
            {morePlans.plans.slice(2).map((plan) => <Button key={plan.id} className='extra-plan-option' onClick={() => { choosePlan(morePlans.id, plan.id); setMorePlans(null) }}><Text>{plan.name}</Text><Text>¥{plan.premium.toFixed(2)}</Text></Button>)}
          </ScrollView>
        </View>
      </View>}

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
              <RichText className='detail-summary' nodes={detail.plan.description} />
              {detail.plan.protections.map((item) => (
                <View className='detail-item' key={item.name}>
                  <View className='detail-item-heading'><Text>{item.name}</Text><Text>{item.amount}</Text></View>
                  <RichText className='detail-item-text' nodes={item.description} />
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
              <Text className='sheet-title'>投保须知</Text>
              <View className='sheet-close' onClick={() => setNoticeVisible(false)}>×</View>
            </View>
            <ScrollView className='sheet-content' scrollY>
              {productConfig.forceRead.map((document) => <View key={document.id}>
                <Text className='notice-section-title'>{document.title}</Text>
                {document.contentType === 'text' ? document.content.map((content, index) => <RichText className='notice-paragraph' key={index} nodes={content} />) : <Button className='ui-secondary-button' hoverClass='ui-button-hover' onClick={() => void openProductDocument(document).catch(() => undefined)}>查看文件</Button>}
              </View>)}
            </ScrollView>
            <Button className='sheet-button' onClick={() => setNoticeVisible(false)}>我知道了</Button>
          </View>
        </View>
      )}
    </View>
  )
}
