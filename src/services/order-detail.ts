import { parseApiJson } from './json'
import type { ServerOrder } from './order'

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const parse = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try { return parseApiJson(value) } catch { return undefined }
}
const text = (value: unknown, fallback = '—'): string => {
  if (value == null || value === '') return fallback
  if (['string', 'number', 'boolean'].includes(typeof value)) return String(value)
  if (Array.isArray(value)) return value.map(item => record(item) || Array.isArray(item) ? '—' : text(item)).join('、')
  return fallback
}
const safeName = (name: string) => /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && !['__proto__', 'prototype', 'constructor'].includes(name)
const sorted = (value: unknown): Record<string, unknown>[] => Array.isArray(value)
  ? value.filter(record).sort((a, b) => (Number.isFinite(Number(a.sort)) ? Number(a.sort) : 0) - (Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0)) : []

export type OrderDetailField = { name: string; label: string; value: string }
export type OrderDetailSection = { name: string; fields: OrderDetailField[] }
export type OrderDetailPlan = { name: string; company: string; plans: string }
export type OrderFieldLabel = { name: string; label: string; blockName?: string }

export function orderFieldLabels(value: unknown, blockName?: string): OrderFieldLabel[] {
  return sorted(parse(value)).flatMap(field => {
    if (Array.isArray(field.fieldConfigList)) return orderFieldLabels(field.fieldConfigList, text(field.blockName, ''))
    return typeof field.fieldName === 'string' && safeName(field.fieldName) && typeof field.fieldLabel === 'string'
      && field.fieldLabel.trim() && field.fieldLabel.trim() !== field.fieldName && String(field.visible ?? '1') !== '0'
      ? [{ name: field.fieldName, label: field.fieldLabel.trim(), blockName }] : []
  })
}

/** 值始终取订单快照；优先历史标签，产品配置仅补充缺失的名称。 */
export function parseOrderDetail(order: Pick<ServerOrder, 'orderData' | 'fieldData'>, fallbackLabels: readonly OrderFieldLabel[] = []) {
  const data = parse(order.orderData)
  const historicalLabels = orderFieldLabels(order.fieldData)
  let hasMissingLabels = false
  const sections: OrderDetailSection[] = !record(data) ? [] : sorted(data.blockConfigList).flatMap(block => {
    if (!record(block.fieldConfig)) return []
    const blockName = text(block.blockName, '投保信息')
    const fields = Object.entries(block.fieldConfig).filter(([name]) => safeName(name))
      .map(([name, value], index) => {
        const matches = (field: OrderFieldLabel) => field.name === name && (!field.blockName || field.blockName === blockName)
        const label = historicalLabels.find(matches)?.label || fallbackLabels.find(matches)?.label
        if (!label) hasMissingLabels = true
        return { name, label: label || `信息 ${index + 1}`, value: text(value) }
      })
    return fields.length ? [{ name: blockName, fields }] : []
  })
  const plans: OrderDetailPlan[] = !record(data) ? [] : sorted(data.planGroupList).map(group => ({
    name: text(group.groupName, '保障方案'), company: text(group.insCompanyName),
    plans: sorted(group.planList).map(plan => text(plan.planName)).join('、') || '—'
  }))
  return { productName: record(data) ? text(data.productName, '') : '', plans, sections, hasMissingLabels }
}
