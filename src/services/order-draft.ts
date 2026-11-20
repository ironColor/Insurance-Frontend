import Taro from '@tarojs/taro'
import { calculatePremium, getSelectedPlan, isProductConfigSnapshot } from './product-normalize'
import { INSURANCE_DRAFT_KEY } from './product'
import type { InsuranceDraft } from './product-types'
import type { PayRequest } from './order'


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


export function draftVersion(): string { return JSON.stringify(Taro.getStorageSync(INSURANCE_DRAFT_KEY) || null) }
