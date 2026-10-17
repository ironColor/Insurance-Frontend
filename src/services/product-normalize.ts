import type { InsuredField, ProductConfig, ProductDocument, ProductItem, ProductPlan, ProductReadRule, SelectedPlanMap } from './product-types'

type ApiRecord = Record<string, unknown>

export class ProductUnavailableError extends Error {
  constructor(message = '该产品已下架或不存在，请联系分享人重新获取产品码') {
    super(message)
    this.name = 'ProductUnavailableError'
  }
}

const record = (value: unknown): value is ApiRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string => value == null ? '' : String(value)
const yes = (value: unknown): boolean => value === true || value === 1 || value === '1'
const visible = (item: ApiRecord): boolean => item.visible !== '0' && item.visible !== 0 && item.visible !== false

function mediaUrl(value: unknown): string {
  const url = text(value).trim()
  if (!url || /^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) throw new Error('产品资源地址格式异常，请联系管理员')
  return `https://www.zfxbaoxian.com/${url.replace(/^\/+/, '')}`
}

function list(value: unknown, label: string): ApiRecord[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.some((item) => !record(item))) throw new Error(`${label}配置格式异常，请联系管理员`)
  return [...value].sort((left, right) => (Number(left.sort) || 0) - (Number(right.sort) || 0))
}

export function normalizeProductId(value: unknown, label = '产品'): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error(`${label}编号精度异常，请重新获取`)
  if ((typeof value !== 'string' && typeof value !== 'number') || !String(value).trim()) throw new Error(`${label}编号缺失，请重新获取`)
  return String(value).trim()
}

function identity(item: ApiRecord, key: string, label: string, used: Set<string>): string {
  const id = normalizeProductId(item[key], label)
  if (used.has(id)) throw new Error(`${label}编号重复，请联系管理员`)
  used.add(id)
  return id
}

function price(value: unknown, label: string): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || !String(value).trim()) throw new Error(`${label}保费未配置，请联系管理员`)
  const amount = typeof value === 'number' ? value : /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN
  const cents = Math.round(amount * 100)
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 0.000001) {
    throw new Error(`${label}保费配置异常，请联系管理员`)
  }
  return cents / 100
}

function stringList(value: unknown, separators: RegExp): string[] {
  if (Array.isArray(value)) return value.map((item) => record(item) ? text(item.url ?? item.label ?? item.value) : text(item)).filter(Boolean)
  if (typeof value !== 'string' || !value.trim()) return []
  if (value.trim().startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) return stringList(parsed, separators)
    } catch {
      throw new Error('产品列表配置格式异常，请联系管理员')
    }
  }
  return value.split(separators).map((item) => item.trim()).filter(Boolean)
}

function readRule(item: ApiRecord): ProductReadRule | undefined {
  if (item.isForceRead === '0' || item.isForceRead === 0 || item.isForceRead === false) return undefined
  const styles = stringList(item.readStyle, /[,;；\n]/)
  if (styles.some((style) => style !== '1' && style !== '2')) throw new Error('阅读方式配置异常，请联系管理员')
  const seconds = Number(item.readSeconds ?? 0)
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('阅读时长配置异常，请联系管理员')
  if (styles.includes('2')) return { mode: 'timer', seconds: Math.ceil(seconds), requireScroll: styles.includes('1') }
  if (styles.includes('1')) return { mode: 'scroll', seconds: 0 }
  if (yes(item.isForceRead)) return { mode: 'timer', seconds: 0 }
  return undefined
}

function hasDocumentContent(document: ProductDocument): boolean {
  if (document.contentType !== 'text') return Boolean(document.url)
  return document.content.some((html) => Boolean(html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').trim()) || /<(?:img|video|audio)\b/i.test(html))
}

function documents(value: unknown, label: string): ProductDocument[] {
  const ids = new Set<string>()
  return list(value, label).filter(visible).map((item) => {
    const contentType = item.contentType === '2' || item.contentType === 2 ? 'link' : item.contentType === '3' || item.contentType === 3 ? 'file' : 'text'
    const content = text(item.contentText)
    return {
      id: identity(item, 'docId', label, ids),
      title: text(item.name),
      content: content ? [content] : [],
      contentType,
      url: contentType === 'link' ? mediaUrl(item.contentUrl) : contentType === 'file' ? mediaUrl(item.filePath) : undefined,
      readRule: readRule(item),
      important: item.isForceRead === '0' || item.isForceRead === 0 || item.isForceRead === false
    }
  })
}

const fieldTypes: Record<string, InsuredField['type']> = {
  文本: '文本', text: '文本', input: '文本', textarea: '文本', string: '文本',
  日期: '日期', date: '日期',
  单选: '单选', 下拉: '单选', radio: '单选', select: '单选', single: '单选', dropdown: '单选',
  多选: '多选', checkbox: '多选', multiple: '多选', multiselect: '多选',
  身份证: '身份证', idcard: '身份证', id_card: '身份证', identitycard: '身份证',
  手机: '手机', 手机号: '手机', phone: '手机', mobile: '手机', tel: '手机'
}

function options(value: unknown): { labels: string[]; values: Record<string, string> } {
  let parsed: unknown = value
  if (typeof value === 'string') {
    if (value.trim().startsWith('[')) parsed = JSON.parse(value)
    else parsed = value.split(/[;；\n]/).map((item) => item.trim()).filter(Boolean)
  }
  if (parsed == null || parsed === '') return { labels: [], values: {} }
  if (!Array.isArray(parsed)) throw new Error('选项必须为数组或分号分隔的文本')
  const values: Record<string, string> = Object.create(null)
  const labels = parsed.map((item) => {
    const label = (record(item) ? text(item.label ?? item.value) : text(item)).trim()
    const optionValue = record(item) ? text(item.value ?? item.label) : text(item)
    if (!label || Object.prototype.hasOwnProperty.call(values, label)) throw new Error('选项名称为空或重复')
    values[label] = optionValue
    return label
  })
  return { labels, values }
}

function defaultFieldValue(item: ApiRecord, type: InsuredField['type'], optionValues: Record<string, string>): string {
  const value = text(item.defaultValue)
  if (type !== '单选' && type !== '多选') return value
  const display = (raw: string) => Object.keys(optionValues).find((label) => optionValues[label] === raw) ?? raw
  if (type === '单选') return display(value)
  return stringList(value, /[、,;；\n]/).map(display).join('、')
}

function fields(value: unknown, groupName: string, issues: string[], used: Set<string>): InsuredField[] {
  return list(value, `${groupName}字段`).filter(visible).flatMap((item): InsuredField[] => {
    const label = text(item.fieldLabel || item.fieldName) || '未命名字段'
    const fieldLabel = `“${groupName} / ${label}”`
    if (String(item.visible) === '2' || yes(item.isTrigger) || text(item.triggerFields).trim()) {
      issues.push(`${fieldLabel}使用条件显示或字段联动，当前缺少可执行的条件规则，请联系管理员确认配置`)
      return []
    }
    const fieldType = text(item.fieldType).trim().toLowerCase()
    const type = Object.prototype.hasOwnProperty.call(fieldTypes, fieldType) ? fieldTypes[fieldType] : undefined
    if (!type) {
      issues.push(`${fieldLabel}的字段类型“${text(item.fieldType)}”尚未支持，请联系管理员确认字段字典`)
      return []
    }
    try {
      const fieldOptions = options(item.fieldOptions)
      const optionMode = text(item.optionMode).toLowerCase()
      if ((type === '单选' || type === '多选') && !['', 'manual', 'custom', '自定义'].includes(optionMode)) throw new Error('使用动态选项数据源，当前无法解析')
      if ((type === '单选' || type === '多选') && !fieldOptions.labels.length) throw new Error('缺少可选择的选项')
      if (type === '多选' && fieldOptions.labels.some((label) => label.includes('、'))) throw new Error('多选选项名称包含分隔符“、”，请调整选项名称')
      const defaultValue = defaultFieldValue(item, type, fieldOptions.values)
      if (defaultValue && (type === '单选' || type === '多选')) {
        const defaults = type === '多选' ? defaultValue.split('、') : [defaultValue]
        if (defaults.some((choice) => !fieldOptions.labels.includes(choice))) throw new Error('默认值不在可选范围内')
      }
      if ((item.editable === '0' || item.editable === 0 || item.editable === false) && yes(item.required) && !defaultValue.trim()) throw new Error('必填只读字段未配置默认值')
      return [{
        id: identity(item, 'fieldId', '投保字段', used), name: label, type,
        placeholder: text(item.fieldPlaceholder), required: yes(item.required),
        editable: item.editable !== '0' && item.editable !== 0 && item.editable !== false,
        defaultValue,
        validType: text(item.validType), validRule: text(item.validRule), busiValidType: text(item.busiValidType),
        options: type === '单选' || type === '多选' ? fieldOptions.labels : undefined,
        optionValues: type === '单选' || type === '多选' ? fieldOptions.values : undefined
      }]
    } catch (error) {
      issues.push(`${fieldLabel}配置异常：${error instanceof Error ? error.message : '请联系管理员'}`)
      return []
    }
  })
}

export function normalizeProductConfig(value: unknown, expectedProductId?: string): ProductConfig {
  if (value == null) throw new ProductUnavailableError()
  if (!record(value)) throw new Error('产品配置格式异常，请稍后重试')
  if (value.status === '1' || value.status === 1) throw new ProductUnavailableError()
  const id = normalizeProductId(value.productId)
  if (expectedProductId && id !== expectedProductId) throw new Error('产品编号与请求不一致，请重新进入产品页面')
  const groupIds = new Set<string>()
  const planIds = new Set<string>()
  const products = list(value.planGroupList, '产品方案组').filter(visible).map((group): ProductItem => {
    const plans = list(group.planList, '产品方案').filter(visible).map((plan): ProductPlan => ({
      id: identity(plan, 'planId', '产品方案', planIds), name: text(plan.planName),
      premium: price(plan.price, text(plan.planName) || '产品方案'), description: text(plan.planDesc), isDefault: yes(plan.isDefault),
      protections: list(plan.liabilityList, '保障责任').filter(visible).map((liability) => ({
        name: text(liability.liabilityName), amount: text(liability.sumInsured), description: text(liability.description)
      }))
    }))
    if (!plans.length) throw new Error(`“${text(group.groupName) || '产品方案组'}”暂无可用方案，请联系管理员`)
    const required = yes(group.required)
    const selected = plans.find((plan) => plan.isDefault)
    return {
      id: identity(group, 'groupId', '产品方案组', groupIds), name: text(group.groupName),
      type: group.classify === '2' || group.classify === 2 ? '附加险' : '主险', company: text(group.insCompanyName ?? value.insCompanyName), required,
      defaultPlanId: selected?.id ?? (required || yes(group.isDefault) ? plans[0].id : null), plans
    }
  })
  if (!products.length) throw new Error('该产品暂无可用投保方案，请联系管理员')
  const formIssues: string[] = []
  const blockIds = new Set<string>()
  const fieldIds = new Set<string>()
  const fieldGroups = list(value.blockConfigList, '投保信息分组').filter(visible).flatMap((block) => {
    const name = text(block.blockName)
    const blockFields = fields(block.fieldConfigList, name, formIssues, fieldIds)
    if (!blockFields.length) return []
    return [{ id: identity(block, 'blockId', '投保信息分组', blockIds), name, fields: blockFields }]
  })
  if (!fieldGroups.length && !formIssues.length) formIssues.push('该产品未配置投保信息，请联系管理员完成配置后再投保')
  const service = list(value.servicePhoneList, '客服电话').find(visible)
  const media = record(value.media) ? value.media : {}
  const forceRead = documents(value.forceDocList, '阅读文件')
  const configuredDocuments = list(value.docList, '产品协议')
  const agreements = documents(configuredDocuments.filter((doc) => doc.classify == null || String(doc.classify) === '2'), '产品协议')
  for (const document of [...forceRead, ...agreements]) {
    if (!hasDocumentContent(document)) formIssues.push(`“${document.title || '未命名阅读文件'}”的${document.contentType === 'text' ? '正文' : '访问地址'}未配置，请联系管理员完善阅读文件`)
  }
  const intervals = Number(media.intervals)
  const configuredRules = forceRead.map((doc) => doc.readRule).filter((rule): rule is ProductReadRule => Boolean(rule))
  const timerSeconds = Math.max(0, ...configuredRules.filter((rule) => rule.mode === 'timer').map((rule) => rule.seconds))
  return {
    id, title: text(value.productName || value.productTitle), subtitle: text(value.productTitle), servicePhone: text(service?.phone),
    products, fieldGroups, forceRead,
    readRule: timerSeconds > 0 ? { mode: 'timer', seconds: timerSeconds } : { mode: 'scroll', seconds: 0 }, formIssues,
    intro: {
      location: text(value.businessDeptName), letterTitle: text(value.productName || value.productTitle),
      letterContent: text(media.introInfo ?? value.introInfo ?? value.productDesc),
      media: media.type === '2' || media.type === 2
        ? { mode: 'images', images: stringList(media.picUrl, /[,;；\n]/).map(mediaUrl), interval: Number.isFinite(intervals) && intervals > 0 ? intervals * 1000 : 3000 }
        : { mode: 'video', videoUrl: mediaUrl(media.videoUrl) },
      serviceTime: text(service?.serviceTime), companySlogan: text(service?.description),
      agreements,
      documents: documents(configuredDocuments.filter((doc) => String(doc.classify) === '3'), '产品文件')
    }
  }
}

export function normalizeProductScene(value: unknown): { productId: string; shareUser?: string } {
  if (value == null) throw new ProductUnavailableError('该产品码已失效，请联系分享人重新获取')
  if (!record(value)) throw new Error('产品码解析结果异常，请重新扫码')
  return {
    productId: normalizeProductId(value.productId),
    shareUser: value.shareUser == null || value.shareUser === '' ? undefined : normalizeProductId(value.shareUser, '分享人')
  }
}

export function createDefaultSelections(config: ProductConfig): SelectedPlanMap {
  return Object.fromEntries(config.products.map((product) => [product.id, product.defaultPlanId]))
}

export function getSelectedPlan(product: ProductItem, selections: SelectedPlanMap): ProductPlan | undefined {
  return product.plans.find((plan) => plan.id === selections[product.id])
}

export function calculatePremium(config: ProductConfig, selections: SelectedPlanMap): number {
  if (Object.keys(selections).some((id) => selections[id] != null && !config.products.some((product) => product.id === id))) throw new Error('所选产品方案已失效，请重新选择')
  let totalCents = 0
  for (const product of config.products) {
    const selected = selections[product.id]
    const plan = getSelectedPlan(product, selections)
    if (selected != null && !plan) throw new Error('所选方案已失效，请重新选择')
    if (!plan) {
      if (product.required) throw new Error(`请选择${product.name}的投保方案`)
      continue
    }
    totalCents += Math.round(price(plan.premium, plan.name) * 100)
    if (!Number.isSafeInteger(totalCents)) throw new Error('保费合计超出有效范围，请联系管理员')
  }
  return totalCents / 100
}

const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')
const optionalString = (value: unknown): boolean => value === undefined || typeof value === 'string'
const optionalBoolean = (value: unknown): boolean => value === undefined || typeof value === 'boolean'

function isReadRule(value: unknown): boolean {
  return record(value) && ['scroll', 'timer'].includes(text(value.mode)) && typeof value.seconds === 'number' && Number.isFinite(value.seconds) && value.seconds >= 0 && optionalBoolean(value.requireScroll)
}

function isDocument(value: unknown): boolean {
  return record(value) && typeof value.id === 'string' && Boolean(value.id) && typeof value.title === 'string' && strings(value.content) && ['text', 'link', 'file'].includes(text(value.contentType)) && optionalString(value.url) && optionalBoolean(value.important) && (value.readRule === undefined || isReadRule(value.readRule))
}

function isPlan(value: unknown): boolean {
  if (!record(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || typeof value.description !== 'string' || typeof value.premium !== 'number' || !optionalBoolean(value.isDefault) || !Array.isArray(value.protections)) return false
  if (!value.protections.every((item) => record(item) && typeof item.name === 'string' && typeof item.amount === 'string' && typeof item.description === 'string')) return false
  try { price(value.premium, value.name); return true } catch { return false }
}

function isField(value: unknown): boolean {
  if (!record(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !['文本', '日期', '单选', '多选', '身份证', '手机'].includes(text(value.type))) return false
  if (typeof value.placeholder !== 'string' || typeof value.required !== 'boolean' || !optionalBoolean(value.editable) || !optionalString(value.defaultValue) || !optionalString(value.validType) || !optionalString(value.validRule) || !optionalString(value.busiValidType)) return false
  return (value.options === undefined || strings(value.options)) && (value.optionValues === undefined || record(value.optionValues) && Object.values(value.optionValues).every((item) => typeof item === 'string'))
}

/** 检查本地订单快照的基础结构；历史记录没有快照时交由页面提示。 */
export function isProductConfigSnapshot(value: unknown): value is ProductConfig {
  if (!record(value) || typeof value.id !== 'string' || !value.id || typeof value.title !== 'string' || typeof value.subtitle !== 'string' || typeof value.servicePhone !== 'string' || !record(value.intro)) return false
  if (!Array.isArray(value.products) || !value.products.length || !Array.isArray(value.fieldGroups) || !Array.isArray(value.forceRead) || !strings(value.formIssues) || !isReadRule(value.readRule)) return false
  const intro = value.intro
  if (!value.forceRead.every(isDocument) || !['location', 'letterTitle', 'letterContent', 'serviceTime', 'companySlogan'].every((key) => typeof intro[key] === 'string')) return false
  const media = intro.media
  if (!record(media) || !['video', 'images'].includes(text(media.mode)) || !optionalString(media.videoUrl) || (media.images !== undefined && !strings(media.images)) || (media.interval !== undefined && (typeof media.interval !== 'number' || !Number.isFinite(media.interval) || media.interval <= 0))) return false
  if (!Array.isArray(intro.agreements) || !intro.agreements.every(isDocument) || (intro.documents !== undefined && (!Array.isArray(intro.documents) || !intro.documents.every(isDocument)))) return false
  const plansValid = value.products.every((product) => record(product) && typeof product.id === 'string' && Boolean(product.id) && typeof product.name === 'string' && typeof product.company === 'string' && ['主险', '附加险'].includes(text(product.type)) && typeof product.required === 'boolean' && (product.defaultPlanId === null || typeof product.defaultPlanId === 'string') && Array.isArray(product.plans) && product.plans.length > 0 && product.plans.every(isPlan))
  return plansValid && value.fieldGroups.every((group) => record(group) && typeof group.id === 'string' && Boolean(group.id) && typeof group.name === 'string' && Array.isArray(group.fields) && group.fields.every(isField))
}
