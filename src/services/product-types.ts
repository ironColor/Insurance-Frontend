export type ProtectionItem = {
  name: string
  amount: string
  description: string
}

export type ProductPlan = {
  id: string
  name: string
  premium: number
  description: string
  protections: ProtectionItem[]
  isDefault?: boolean
}

export type ProductItem = {
  id: string
  name: string
  type: '主险' | '附加险'
  company: string
  required: boolean
  defaultPlanId: string | null
  plans: ProductPlan[]
}

export type InsuredField = {
  id: string
  name: string
  type: '文本' | '日期' | '单选' | '多选' | '身份证' | '手机'
  placeholder: string
  required: boolean
  options?: string[]
  /** 页面存储显示标签；后续真实提交时用此映射恢复接口选项值。 */
  optionValues?: Record<string, string>
  defaultValue?: string
  editable?: boolean
  validType?: string
  validRule?: string
  busiValidType?: string
}

export type FieldGroup = {
  id: string
  name: string
  fields: InsuredField[]
}

export type ProductReadRule = { mode: 'scroll' | 'timer'; seconds: number; requireScroll?: boolean }

export type ProductDocument = {
  id: string
  title: string
  /** 保留服务端 HTML，不拆分标签。 */
  content: string[]
  contentType: 'text' | 'link' | 'file'
  url?: string
  readRule?: ProductReadRule
  important?: boolean
}

export type ForceReadItem = ProductDocument

export type ProductConfig = {
  id: string
  title: string
  subtitle: string
  servicePhone: string
  products: ProductItem[]
  fieldGroups: FieldGroup[]
  forceRead: ForceReadItem[]
  readRule: ProductReadRule
  /** 介绍和方案可浏览，未支持的表单配置须在投保前明确提示。 */
  formIssues: string[]
  intro: {
    location: string
    letterTitle: string
    letterContent: string
    media: {
      mode: 'video' | 'images'
      videoUrl?: string
      images?: string[]
      /** 毫秒。 */
      interval?: number
    }
    serviceTime: string
    companySlogan: string
    agreements: ProductDocument[]
    documents?: ProductDocument[]
  }
}

export type SelectedPlanMap = Record<string, string | null>

export type InsuranceDraft = {
  productId: string
  productConfig: ProductConfig
  shareUser?: string
  selectedPlans: SelectedPlanMap
  totalPremium: number
  formValues: Record<string, string>
}

export type OrderRecord = {
  id: string
  productId?: string
  productConfig?: ProductConfig
  shareUser?: string
  createdAt: string
  paidAt?: string
  status: '待支付' | '已支付' | '支付失败' | '退款中' | '退款完成'
  totalPremium: number
  selectedPlans: SelectedPlanMap
  formValues: Record<string, string>
}
