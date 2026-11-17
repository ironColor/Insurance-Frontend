import Taro from '@tarojs/taro'
import { calculatePremium, getSelectedPlan, isProductConfigSnapshot } from './product-normalize'
import { INSURANCE_DRAFT_KEY } from './product'
import type { InsuranceDraft } from './product-types'
import type { PayRequest } from './order'
import { getAuthSession } from './session'

export function newOrderRequest(draft: InsuranceDraft, channel: string): PayRequest {
  const config = draft?.productConfig
  if (!isProductConfigSnapshot(config) || config.id !== draft.productId || config.formIssues.length) throw new Error('产品配置已失效，请重新进入产品填写')
  const planGroupList = config.products.flatMap(group => {
    const plan = getSelectedPlan(group, draft.selectedPlans)
    return plan ? [{ groupId: group.id, groupName: group.name, classify: group.classify, insCompanyName: group.company, groupDesc: group.description, sort: group.sort,
      planList: [{ planId: plan.id, planName: plan.name, planDesc: plan.description, price: plan.premium, sort: plan.sort }] }] : []
  })
  if (!planGroupList.length) throw new Error('请选择投保方案')
  const blockConfigList = config.fieldGroups.map(group => {
    const fieldConfig: Record<string, string> = Object.create(null)
    for (const field of group.fields) {
      if (!field.fieldName || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.fieldName) || Object.prototype.hasOwnProperty.call(fieldConfig, field.fieldName)) throw new Error('投保字段标识缺失或重复，请重新获取产品配置')
      const value = draft.formValues[field.id] || ''
      if (field.required && !value.trim()) throw new Error(`请填写${field.name}`)
      if (field.type === '多选' && value) {
        const values = value.split('、')
        if (values.some(item => !Object.prototype.hasOwnProperty.call(field.optionValues || {}, item))) throw new Error(`请重新选择${field.name}`)
        fieldConfig[field.fieldName] = values.map(item => field.optionValues![item]).join('、')
        continue
      }
      if (field.type === '单选' && value && !Object.prototype.hasOwnProperty.call(field.optionValues || {}, value)) throw new Error(`请重新选择${field.name}`)
      fieldConfig[field.fieldName] = field.optionValues?.[value] ?? value
    }
    return { blockName: group.name, sort: group.sort, fieldConfig }
  })
  return { amount: calculatePremium(config, draft.selectedPlans), subject: config.title, productId: config.id, channel, method: '4', ...(draft.shareUser ? { shareUser: draft.shareUser } : {}),
    orderData: JSON.stringify({ productId: config.id, productName: config.title, planGroupList, blockConfigList }) }
}

// One outstanding creation per account and product. Never store form data or payment signatures here.
export function creationKey(productId: string): string {
  const user = getAuthSession()?.userId
  if (!user) throw new Error('请先登录后支付')
  return `insurance-create:v2:${encodeURIComponent(user)}:${encodeURIComponent(productId)}`
}
export type Creation = { state: 'pending' | 'known'; orderNo?: string }
export function readCreation(key: string): Creation | undefined { return Taro.getStorageSync(key) || undefined }
export function persistCreation(key: string, value: Creation) {
  Taro.setStorageSync(key, value)
  const saved = readCreation(key)
  if (saved?.state !== value.state || saved.orderNo !== value.orderNo) throw new Error('无法保存订单恢复记录，已停止支付，请查询我的订单')
}
export function beginCreation(key: string) {
  if (readCreation(key)) throw new Error('已有下单记录，请先查询订单，勿重复创建')
  persistCreation(key, { state: 'pending' })
}
export function releaseKnownCreation(key: string, orderNo: string) {
  const saved = readCreation(key)
  if (saved?.state !== 'known' || saved.orderNo !== orderNo) throw new Error('未知下单结果不能清除，请联系客服核实')
  Taro.removeStorageSync(key)
}
export function draftVersion(): string { return JSON.stringify(Taro.getStorageSync(INSURANCE_DRAFT_KEY) || null) }
