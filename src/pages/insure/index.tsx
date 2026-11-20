import { Button, Input, Picker, RichText, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'

import { INSURANCE_DRAFT_KEY, InsuranceDraft, ProductConfig, calculatePremium, getSelectedPlan } from '../../services/product'

import { useProductConfig } from '../../hooks/use-product'
import { buildProductUrl } from '../../services/product-entry'
import { openProductDocument } from '../../services/product-document'

import './index.css'

type ErrorMap = Record<string, string>

export default function InsurePage() {
  const { config, loading, error, reload } = useProductConfig()
  const [savedDraft] = useState(() => Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY))
  if (!config) return <View className='insure-page product-load-state ui-state'>
    <View className={loading ? 'ui-state-spinner' : 'ui-state-mark'}>{loading ? '' : '!'}</View>
    <Text className='ui-state-title'>{loading ? '正在加载投保信息…' : '投保信息暂时无法加载'}</Text>
    {!loading && <><Text className='ui-state-copy'>{error || '产品信息暂不可用，请稍后重试'}</Text><Button className='ui-primary-button' hoverClass='ui-button-hover' onClick={reload}>重新加载</Button></>}
  </View>
  const selections = savedDraft?.selectedPlans || {}
  const validSavedValues = savedDraft?.formValues && typeof savedDraft.formValues === 'object' && !Array.isArray(savedDraft.formValues) && Object.values(savedDraft.formValues).every((value) => typeof value === 'string')
  const invalidSelection = config.products.some((product) => (product.required || selections[product.id]) && !getSelectedPlan(product, selections)) || Object.keys(selections).some((id) => selections[id] && !config.products.some((product) => product.id === id))
  if (savedDraft?.productId !== config.id || !savedDraft.productConfig || !validSavedValues || invalidSelection || !config.products.some((product) => getSelectedPlan(product, selections))) {
    return <View className='insure-page product-load-state ui-state'><View className='ui-state-mark'>!</View><Text className='ui-state-title'>投保方案已变更，请重新选择</Text><Button className='ui-primary-button' hoverClass='ui-button-hover' onClick={() => Taro.redirectTo({ url: buildProductUrl('/pages/plan/index', config.id, savedDraft?.shareUser) })}>重新选择方案</Button></View>
  }
  const initialDraft = { ...savedDraft, productConfig: config, totalPremium: calculatePremium(config, selections) }
  return <InsureContent key={config.id} productConfig={config} initialDraft={initialDraft} />
}

function InsureContent({ productConfig, initialDraft }: { productConfig: ProductConfig; initialDraft: InsuranceDraft }) {
  const readItems = productConfig.forceRead.filter((item) => !item.important)
  const importantNotices = productConfig.forceRead.filter((item) => item.important)
  const [draft, setDraft] = useState<InsuranceDraft>(initialDraft)
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(productConfig.fieldGroups.flatMap((group) => group.fields.map((field) => [field.id, field.editable === false ? field.defaultValue || '' : draft.formValues[field.id] ?? field.defaultValue ?? '']))))
  const [errors, setErrors] = useState<ErrorMap>({})
  const [detailVisible, setDetailVisible] = useState(false)
  const [multiSelectField, setMultiSelectField] = useState<{ id: string; name: string; options: string[] } | null>(null)
  const [readVisible, setReadVisible] = useState(false)
  const [readIndex, setReadIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const currentRead = readItems[readIndex]
  const readRule = currentRead?.readRule || productConfig.readRule
  const [openedDocuments, setOpenedDocuments] = useState<string[]>([])
  const [readingActive, setReadingActive] = useState(true)
  useDidShow(() => setReadingActive(true))
  useDidHide(() => setReadingActive(false))
  const requiresScroll = readRule.mode === 'scroll' || readRule.requireScroll === true
  const externalScrollRequired = Boolean(currentRead && currentRead.contentType !== 'text' && requiresScroll)

  const feeItems = useMemo(() => productConfig.products.flatMap((product) => {
    const plan = product.plans.find((item) => item.id === draft.selectedPlans[product.id])
    return plan ? [{ productName: product.name, planName: plan.name, premium: plan.premium }] : []
  }), [productConfig, draft.selectedPlans])

  const canCompleteRead = Boolean(currentRead) && !externalScrollRequired && (currentRead.contentType === 'text' || openedDocuments.includes(currentRead.id)) && (readRule.mode !== 'timer' || remaining === 0) && (!requiresScroll || scrolledToEnd)

  useEffect(() => {
    if (!readVisible || !readingActive || remaining <= 0 || (currentRead?.contentType !== 'text' && !openedDocuments.includes(currentRead?.id))) return
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [readVisible, readingActive, remaining, currentRead?.id, currentRead?.contentType, openedDocuments])

  useEffect(() => {
    if (!readVisible || !currentRead || currentRead.contentType !== 'text' || !requiresScroll || currentRead.content.some((html) => /<img\b/i.test(html))) return
    Taro.nextTick(() => {
      const query = Taro.createSelectorQuery()
      query.select('.read-content').boundingClientRect()
      query.select('.read-document-body').boundingClientRect()
      query.exec((rects) => {
        const viewport = rects[0] as { height?: number } | null
        const content = rects[1] as { height?: number } | null
        if (viewport?.height && content?.height && content.height <= viewport.height) setScrolledToEnd(true)
      })
    })
  }, [readVisible, readIndex, currentRead?.id, requiresScroll])

  const updateValue = (id: string, value: string) => {
    setValues((current) => ({ ...current, [id]: value }))
    setErrors((current) => ({ ...current, [id]: '' }))
  }

  const validate = () => {
    const nextErrors: ErrorMap = {}
    if (productConfig.formIssues.length) {
      Taro.showModal({ title: '暂时无法投保', content: '该产品的投保信息暂不可用，请联系客服后重试。', showCancel: false })
      return false
    }
    productConfig.fieldGroups.forEach((group) => group.fields.forEach((field) => {
      const value = (values[field.id] || '').trim()
      if (field.required && !value) nextErrors[field.id] = `请${field.type === '文本' || field.type === '身份证' || field.type === '手机' ? '输入' : '选择'}${field.name}`
      else if (field.type === '身份证' && value) {
        if (!/^\d{17}[\dXx]$/.test(value)) nextErrors[field.id] = '身份证号码格式不正确，请检查后重试'
      }
      else if (field.type === '手机' && value && !/^1\d{10}$/.test(value)) nextErrors[field.id] = '联系电话位数不正确，请检查后重试'
      else if (field.type === '单选' && value && !field.options?.includes(value)) nextErrors[field.id] = `请重新选择${field.name}`
      else if (field.type === '多选' && value && value.split('、').some((item) => !field.options?.includes(item))) nextErrors[field.id] = `请重新选择${field.name}`
    }))
    setErrors(nextErrors)
    const firstMessage = Object.values(nextErrors)[0]
    if (firstMessage) Taro.showToast({ title: firstMessage, icon: 'none' })
    return !firstMessage
  }

  const openForceRead = () => {
    const nextDraft = { ...draft, formValues: values }
    setDraft(nextDraft)
    Taro.setStorageSync(INSURANCE_DRAFT_KEY, nextDraft)
    if (readItems.length === 0) {
      Taro.navigateTo({ url: buildProductUrl('/pages/order-confirm/index', productConfig.id, draft.shareUser) })
      return
    }
    setReadIndex(0)
    const rule = readItems[0]?.readRule || productConfig.readRule
    setRemaining(rule.mode === 'timer' ? rule.seconds : 0)
    setScrolledToEnd(false)
    setOpenedDocuments([])
    setReadVisible(true)
  }

  const submit = async () => {
    if (!validate()) return
    openForceRead()
  }

  const completeCurrentRead = () => {
    if (!canCompleteRead) return
    if (readIndex < readItems.length - 1) {
      const nextIndex = readIndex + 1
      setReadIndex(nextIndex)
      const rule = readItems[nextIndex]?.readRule || productConfig.readRule
      setRemaining(rule.mode === 'timer' ? rule.seconds : 0)
      setScrolledToEnd(false)
      return
    }
    setReadVisible(false)
    Taro.navigateTo({ url: buildProductUrl('/pages/order-confirm/index', productConfig.id, draft.shareUser) })
  }

  return (
    <View className='insure-page'>
      <View className='insure-intro'>请准确填写投保人和被保险人信息。</View>
      {productConfig.formIssues.length > 0 && <View className='insure-config-error'><Text>暂时无法投保</Text><Text>该产品的投保信息暂不可用，请联系客服后重试。</Text></View>}
      {importantNotices.map((notice) => <View className='read-important-notice' key={notice.id}>
        <Text className='read-important-title'>{notice.title}</Text>
        {notice.contentType === 'text' ? notice.content.map((html, index) => <RichText className='read-important-paragraph' key={index} nodes={html} />) : <Button className='ui-secondary-button' hoverClass='ui-button-hover' onClick={() => void openProductDocument(notice).catch(() => undefined)}>查看文件</Button>}
      </View>)}
      {productConfig.fieldGroups.map((group) => (
        <View className='form-section' key={group.id}>
          <Text className='form-section-title'>{group.name}</Text>
          {group.fields.map((field) => {
            return (
              <View className={`form-row-wrap ${errors[field.id] ? 'form-row-error' : ''}`} key={field.id}>
                {field.type === '日期' ? (
                  <Picker
                    mode='date'
                    disabled={field.editable === false}
                    value={values[field.id] || '2015-01-01'}
                    onChange={(event) => updateValue(field.id, String(event.detail.value))}
                  >
                    <View className='form-row'>
                      <Text className='form-label'>{field.required && <Text className='required-mark'>*</Text>}{field.name}</Text>
                      <Text className={values[field.id] ? 'form-value' : 'form-placeholder'}>{values[field.id] || field.placeholder}</Text>
                      <Text className='form-arrow'>›</Text>
                    </View>
                  </Picker>
                ) : field.type === '多选' ? (
                  <View className='form-row' onClick={() => field.editable !== false && setMultiSelectField({ id: field.id, name: field.name, options: field.options || [] })}>
                    <Text className='form-label'>{field.required && <Text className='required-mark'>*</Text>}{field.name}</Text>
                    <Text className={values[field.id] ? 'form-value' : 'form-placeholder'}>{values[field.id] || field.placeholder}</Text>
                    <Text className='form-arrow'>›</Text>
                  </View>
                ) : field.type === '单选' ? (
                  <Picker
                    mode='selector'
                    disabled={field.editable === false}
                    range={field.options || []}
                    onChange={(event) => updateValue(field.id, field.options?.[Number(event.detail.value)] || '')}
                  >
                    <View className='form-row'>
                      <Text className='form-label'>{field.required && <Text className='required-mark'>*</Text>}{field.name}</Text>
                      <Text className={values[field.id] ? 'form-value' : 'form-placeholder'}>{values[field.id] || field.placeholder}</Text>
                      <Text className='form-arrow'>›</Text>
                    </View>
                  </Picker>
                ) : (
                  <View className='form-row'>
                    <Text className='form-label'>{field.required && <Text className='required-mark'>*</Text>}{field.name}</Text>
                    <Input
                      className='form-input'
                      disabled={field.editable === false}
                      type={field.type === '手机' ? 'number' : 'text'}
                      maxlength={field.type === '身份证' ? 20 : field.type === '手机' ? 11 : 50}
                      placeholder={field.placeholder}
                      value={values[field.id] || ''}
                      onInput={(event) => updateValue(field.id, event.detail.value)}
                    />
                  </View>
                )}
                {errors[field.id] && <Text className='field-error'>{errors[field.id]}</Text>}
              </View>
            )
          })}
        </View>
      ))}

      <View className='privacy-tip'>身份信息将用于核保、生成保单和理赔服务，请确保填写真实有效。</View>

      <View className='insure-action-bar'>
        <View className='insure-premium'>
          <View><Text className='premium-symbol'>¥</Text><Text className='premium-number'>{draft.totalPremium.toFixed(2)}</Text></View>
          <Text className='detail-trigger' onClick={() => setDetailVisible(true)}>查看明细</Text>
        </View>
        <Button className='submit-insure-button' disabled={productConfig.formIssues.length > 0} onClick={submit}>立即投保</Button>
      </View>

      {detailVisible && (
        <View className='dialog-mask' onClick={() => setDetailVisible(false)}>
          <View className='fee-dialog' onClick={(event) => event.stopPropagation()}>
            <View className='dialog-header'><Text>查看缴费明细</Text><Text className='dialog-close' onClick={() => setDetailVisible(false)}>×</Text></View>
            {feeItems.map((item) => (
              <View className='fee-row' key={item.productName}>
                <View><Text className='fee-name'>{item.productName}</Text><Text className='fee-note'>{item.planName}（全额缴纳）</Text></View>
                <Text className='fee-value'>¥{item.premium.toFixed(2)}</Text>
              </View>
            ))}
            <View className='fee-total'><Text>总计</Text><Text>¥{draft.totalPremium.toFixed(2)}</Text></View>
          </View>
        </View>
      )}

      {multiSelectField && (
        <View className='dialog-mask' onClick={() => setMultiSelectField(null)}>
          <View className='fee-dialog' onClick={(event) => event.stopPropagation()}>
            <View className='dialog-header'><Text>{multiSelectField.name}</Text><Text className='dialog-close' onClick={() => setMultiSelectField(null)}>×</Text></View>
            {multiSelectField.options.map((option) => {
              const selected = (values[multiSelectField.id] || '').split('、').includes(option)
              return <View className='multi-option' key={option} onClick={() => {
                const next = new Set((values[multiSelectField.id] || '').split('、').filter(Boolean))
                if (selected) next.delete(option)
                else next.add(option)
                updateValue(multiSelectField.id, multiSelectField.options.filter((item) => next.has(item)).join('、'))
              }}><Text>{option}</Text><Text className={selected ? 'multi-check selected' : 'multi-check'}>{selected ? '✓' : ''}</Text></View>
            })}
            <Button className='multi-done ui-primary-button' hoverClass='ui-button-hover' onClick={() => setMultiSelectField(null)}>确定</Button>
          </View>
        </View>
      )}

      {readVisible && currentRead && (
        <View className='read-mask'>
          <View className='read-panel'>
            <View className='read-header'>
              <Text className='read-title'>{currentRead.title}</Text>
              <Text className='read-step'>{readIndex + 1}/{readItems.length}</Text>
            </View>
            <View className='read-tabs'>
              {readItems.map((item, index) => <Text key={item.id} className={index === readIndex ? 'read-tab-active' : ''}>{item.title}</Text>)}
            </View>
            <ScrollView key={currentRead.id} className='read-content' scrollY onScrollToLower={() => setScrolledToEnd(true)} lowerThreshold={12}>
              <View className='read-document-body'>
                <Text className='read-content-title'>{currentRead.title}</Text>
                {currentRead.contentType === 'text' ? currentRead.content.map((paragraph, index) => <RichText className='read-paragraph' key={index} nodes={paragraph} />) : <Button className='ui-secondary-button' hoverClass='ui-button-hover' onClick={async () => {
                  try {
                    await openProductDocument(currentRead)
                    setOpenedDocuments((items) => [...items.filter((id) => id !== currentRead.id), currentRead.id])
                  } catch {
                    // 文件未打开时保留未阅读状态，辅助方法会显示失败原因。
                  }
                }}>打开文件阅读</Button>}
                <View className='read-end'>— 已阅读至底部 —</View>
              </View>
            </ScrollView>
            {readIndex === 0 && importantNotices.length > 0 && (
              <View className='read-important-notice'>
                {importantNotices.map((notice) => (
                  <View key={notice.id}>
                    <Text className='read-important-title'>{notice.title}：</Text>
                    {notice.content.map((paragraph) => <RichText className='read-important-paragraph' key={paragraph} nodes={paragraph} />)}
                  </View>
                ))}
              </View>
            )}
            <Text className='read-rule-tip'>
              {externalScrollRequired ? '暂时无法完成该文件的阅读确认，请联系客服' : currentRead.contentType !== 'text' && !openedDocuments.includes(currentRead.id) ? '请先打开文件阅读' : readRule.mode === 'timer' && remaining > 0 ? `请继续阅读 ${remaining} 秒` : requiresScroll && !scrolledToEnd ? '请下滑完整阅读页面内容' : '已满足阅读条件'}
            </Text>
            <Button className={`read-button ${canCompleteRead ? 'read-button-enabled' : ''}`} disabled={!canCompleteRead} onClick={completeCurrentRead}>
              我已阅读并同意，{readIndex < readItems.length - 1 ? '下一步' : '确认订单'}
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
