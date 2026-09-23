import { Button, Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'

import { INSURANCE_DRAFT_KEY, INSURANCE_ORDERS_KEY, InsuranceDraft, OrderRecord, productConfig } from '../../services/product'

import './index.css'

type ErrorMap = Record<string, string>

export default function InsurePage() {
  const [draft, setDraft] = useState<InsuranceDraft>(() => Taro.getStorageSync<InsuranceDraft>(INSURANCE_DRAFT_KEY) || { selectedPlans: {}, totalPremium: 0, formValues: {} })
  const [values, setValues] = useState<Record<string, string>>(draft.formValues || {})
  const [errors, setErrors] = useState<ErrorMap>({})
  const [detailVisible, setDetailVisible] = useState(false)
  const [multiSelectField, setMultiSelectField] = useState<{ id: string; name: string; options: string[] } | null>(null)
  const [readVisible, setReadVisible] = useState(false)
  const [readIndex, setReadIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const currentRead = productConfig.forceRead[readIndex]

  const feeItems = useMemo(() => productConfig.products.flatMap((product) => {
    const plan = product.plans.find((item) => item.id === draft.selectedPlans[product.id])
    return plan ? [{ productName: product.name, planName: plan.name, premium: plan.premium }] : []
  }), [draft.selectedPlans])

  const canCompleteRead = Boolean(currentRead) && (productConfig.readRule.mode === 'timer' ? remaining === 0 : scrolledToEnd)

  useEffect(() => {
    if (!readVisible || remaining <= 0) return
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [readVisible, remaining])

  const updateValue = (id: string, value: string) => {
    setValues((current) => ({ ...current, [id]: value }))
    setErrors((current) => ({ ...current, [id]: '' }))
  }

  const validate = () => {
    const nextErrors: ErrorMap = {}
    productConfig.fieldGroups.forEach((group) => group.fields.forEach((field) => {
      const value = (values[field.id] || '').trim()
      if (field.required && !value) nextErrors[field.id] = `请${field.type === '文本' || field.type === '身份证' || field.type === '手机' ? '输入' : '选择'}${field.name}`
      else if (field.type === '身份证' && value) {
        const certificateType = values[field.id.replace('id-number', 'id-type')]
        const valid = certificateType === '居民身份证' ? /^\d{17}[\dXx]$/.test(value) : /^[A-Za-z0-9]{5,20}$/.test(value)
        if (!valid) nextErrors[field.id] = certificateType === '居民身份证' ? '身份证号码位数不正确，请检查后重试' : '证件号码格式不正确，请检查后重试'
      }
      else if (field.type === '手机' && value && !/^1\d{10}$/.test(value)) nextErrors[field.id] = '联系电话位数不正确，请检查后重试'
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
    setReadIndex(0)
    setRemaining(productConfig.readRule.mode === 'timer' ? productConfig.readRule.seconds : 0)
    setScrolledToEnd(false)
    setReadVisible(true)
  }

  const submit = async () => {
    if (!validate()) return
    const studentId = values['student-id-number']?.trim().toUpperCase()
    const paidOrder = (Taro.getStorageSync<OrderRecord[]>(INSURANCE_ORDERS_KEY) || []).find(
      (order) => order.status === '已支付' && order.formValues['student-id-number']?.trim().toUpperCase() === studentId
    )
    if (paidOrder) {
      const result = await Taro.showModal({
        title: '该学生已有已支付订单',
        content: '系统检测到该证件对应的学生已有已支付订单，请确认是否继续进入投保确认流程。',
        cancelText: '取消',
        confirmText: '确认',
        confirmColor: '#2d91e8'
      })
      if (!result.confirm) return
    }
    openForceRead()
  }

  const completeCurrentRead = () => {
    if (!canCompleteRead) return
    if (readIndex < productConfig.forceRead.length - 1) {
      const nextIndex = readIndex + 1
      setReadIndex(nextIndex)
      setRemaining(productConfig.readRule.mode === 'timer' ? productConfig.readRule.seconds : 0)
      setScrolledToEnd(false)
      return
    }
    setReadVisible(false)
    Taro.navigateTo({ url: '/pages/order-confirm/index' })
  }

  return (
    <View className='insure-page'>
      <View className='insure-intro'>请准确填写以下信息，我们将按配置规则进行校验并保护您的个人信息。</View>
      {productConfig.fieldGroups.map((group) => (
        <View className='form-section' key={group.id}>
          <Text className='form-section-title'>{group.name}</Text>
          {group.fields.map((field) => {
            return (
              <View className={`form-row-wrap ${errors[field.id] ? 'form-row-error' : ''}`} key={field.id}>
                {field.type === '日期' ? (
                  <Picker
                    mode='date'
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
                  <View className='form-row' onClick={() => setMultiSelectField({ id: field.id, name: field.name, options: field.options || [] })}>
                    <Text className='form-label'>{field.required && <Text className='required-mark'>*</Text>}{field.name}</Text>
                    <Text className={values[field.id] ? 'form-value' : 'form-placeholder'}>{values[field.id] || field.placeholder}</Text>
                    <Text className='form-arrow'>›</Text>
                  </View>
                ) : field.type === '单选' ? (
                  <Picker
                    mode='selector'
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
        <Button className='submit-insure-button' onClick={submit}>立即投保</Button>
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
            <Button className='multi-done' onClick={() => setMultiSelectField(null)}>确定</Button>
          </View>
        </View>
      )}

      {readVisible && currentRead && (
        <View className='read-mask'>
          <View className='read-panel'>
            <View className='read-header'>
              <Text className='read-title'>{currentRead.title}</Text>
              <Text className='read-step'>{readIndex + 1}/{productConfig.forceRead.length}</Text>
            </View>
            <View className='read-tabs'>
              {productConfig.forceRead.map((item, index) => <Text key={item.id} className={index === readIndex ? 'read-tab-active' : ''}>{item.title}</Text>)}
            </View>
            <ScrollView className='read-content' scrollY onScrollToLower={() => setScrolledToEnd(true)} lowerThreshold={12}>
              <Text className='read-content-title'>{currentRead.title}</Text>
              {currentRead.content.map((paragraph, index) => <Text className='read-paragraph' key={paragraph}>{index + 1}. {paragraph}</Text>)}
              <Text className='read-section-title'>责任免除与特别约定</Text>
              <Text className='read-paragraph'>因故意行为、违法犯罪以及保险合同明确约定的其他责任免除情形，保险公司不承担赔付责任。请以正式条款为准。</Text>
              <View className='read-end'>— 已阅读至底部 —</View>
            </ScrollView>
            <Text className='read-rule-tip'>
              {productConfig.readRule.mode === 'timer' && remaining > 0 ? `请继续阅读 ${remaining} 秒` : productConfig.readRule.mode === 'scroll' && !scrolledToEnd ? '请下滑完整阅读页面内容' : '已满足阅读条件'}
            </Text>
            <Button className={`read-button ${canCompleteRead ? 'read-button-enabled' : ''}`} disabled={!canCompleteRead} onClick={completeCurrentRead}>
              我已阅读并同意，{readIndex < productConfig.forceRead.length - 1 ? '下一步' : '确认订单'}
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
