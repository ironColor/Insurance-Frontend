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
}

export type ProductItem = {
  id: string
  name: string
  type: '主险' | '附加险'
  company: string
  required: boolean
  plans: ProductPlan[]
}

export type InsuredField = {
  id: string
  name: string
  type: '文本' | '日期' | '单选' | '多选' | '身份证' | '手机'
  placeholder: string
  required: boolean
  options?: string[]
}

export type FieldGroup = {
  id: string
  name: string
  fields: InsuredField[]
}

export type ForceReadItem = {
  id: string
  title: string
  content: string[]
}

export type ProductConfig = {
  id: number
  title: string
  subtitle: string
  servicePhone: string
  products: ProductItem[]
  fieldGroups: FieldGroup[]
  forceRead: ForceReadItem[]
  readRule: { mode: 'scroll' | 'timer'; seconds: number }
}

export type SelectedPlanMap = Record<string, string | null>

export type InsuranceDraft = {
  selectedPlans: SelectedPlanMap
  totalPremium: number
  formValues: Record<string, string>
}

export const INSURANCE_DRAFT_KEY = 'insurance-order-draft'
export const INSURANCE_ORDERS_KEY = 'insurance-orders'

export type OrderRecord = {
  id: string
  createdAt: string
  paidAt?: string
  status: '待支付' | '已支付' | '支付失败' | '退款中' | '退款完成'
  totalPremium: number
  selectedPlans: SelectedPlanMap
  formValues: Record<string, string>
}

const commonProtectionDescriptions: Record<string, string> = {
  '意外身故、残疾': '意外身故或残疾保障，给付条件以正式保险条款为准。',
  疾病身故: '疾病身故保障，适用条件以正式保险条款为准。',
  '意外医疗（门诊、住院）': '意外医疗保障，报销范围及比例以正式保险条款为准。',
  '住院医疗（意外、疾病）': '住院医疗保障，报销范围及比例以正式保险条款为准。',
  重大疾病定额给付: '重大疾病保障，疾病范围及给付条件以正式保险条款为准。',
  动物致伤疫苗费: '动物致伤相关费用保障，适用范围以正式保险条款为准。',
  '牙齿（恒牙）意外损伤': '恒牙意外损伤保障，适用范围以正式保险条款为准。',
  第三者赔偿责任: '第三者赔偿责任保障，适用范围以正式保险条款为准。',
  附加被监护人身故或残疾责任: '被监护人身故或残疾保障，适用范围以正式保险条款为准。'
}

const protections = (items: Array<[string, string]>): ProtectionItem[] =>
  items.map(([name, amount]) => ({ name, amount, description: commonProtectionDescriptions[name] || '具体责任以保险条款为准。' }))

// 字段结构与管理端 ProductConfig 对齐；接入接口后仅替换此服务的返回值。
export const productConfig: ProductConfig = {
  id: 1,
  title: '一份保障，守护孩子每一天',
  subtitle: '针对幼儿、学生设计，含学平险、监护人责任险两套独立方案。',
  servicePhone: '4008000000',
  products: [
    {
      id: 'student-insurance',
      name: '学平险',
      type: '主险',
      company: '中国人寿',
      required: true,
      plans: [
        {
          id: 'student-carefree',
          name: '无忧版',
          premium: 100,
          description: '无忧版覆盖意外、疾病、住院医疗与重大疾病等常见学生风险，保障更全面。',
          protections: protections([
            ['意外身故、残疾', '10万元'],
            ['疾病身故', '10万元'],
            ['意外医疗（门诊、住院）', '1万元'],
            ['住院医疗（意外、疾病）', '10万元'],
            ['重大疾病定额给付', '5万元'],
            ['动物致伤疫苗费', '600元'],
            ['牙齿（恒牙）意外损伤', '2000元']
          ])
        },
        {
          id: 'student-inclusive',
          name: '普惠版',
          premium: 60,
          description: '普惠版聚焦学生高频意外与住院风险，以更轻量的保费提供基础保障。',
          protections: protections([
            ['意外身故、残疾', '5万元'],
            ['疾病身故', '5万元'],
            ['意外医疗（门诊、住院）', '5000元'],
            ['住院医疗（意外、疾病）', '3万元'],
            ['重大疾病定额给付', '3万元'],
            ['动物致伤疫苗费', '300元']
          ])
        }
      ]
    },
    {
      id: 'guardian-liability',
      name: '监护人责任险',
      type: '附加险',
      company: '平安财险',
      required: false,
      plans: [
        {
          id: 'guardian-carefree',
          name: '无忧保障',
          premium: 100,
          description: '为未成年人监护责任提供第三者赔偿及被监护人身故、残疾附加保障。',
          protections: protections([
            ['第三者赔偿责任', '120万元'],
            ['附加被监护人身故或残疾责任', '12万元']
          ])
        },
        {
          id: 'guardian-inclusive',
          name: '普惠保障',
          premium: 40,
          description: '以较低保费覆盖日常监护场景中的主要责任风险。',
          protections: protections([
            ['第三者赔偿责任', '60万元'],
            ['附加被监护人身故或残疾责任', '6万元']
          ])
        }
      ]
    }
  ],
  fieldGroups: [
    {
      id: 'applicant',
      name: '家长信息',
      fields: [
        { id: 'applicant-name', name: '家长姓名', type: '文本', placeholder: '请输入家长姓名', required: true },
        { id: 'applicant-id-type', name: '证件类型', type: '单选', placeholder: '请选择证件类型', required: true, options: ['居民身份证', '护照'] },
        { id: 'applicant-id-number', name: '证件号码', type: '身份证', placeholder: '请输入证件号码', required: true },
        { id: 'applicant-phone', name: '联系电话', type: '手机', placeholder: '请输入联系电话', required: true }
      ]
    },
    {
      id: 'student',
      name: '学生信息',
      fields: [
        { id: 'student-name', name: '学生姓名', type: '文本', placeholder: '请输入学生姓名', required: true },
        { id: 'student-id-type', name: '证件类型', type: '单选', placeholder: '请选择证件类型', required: true, options: ['居民身份证', '护照', '其他证件'] },
        { id: 'student-id-number', name: '证件号码', type: '身份证', placeholder: '请输入证件号码', required: true },
        { id: 'student-school', name: '学校名称', type: '文本', placeholder: '请输入学校名称', required: true },
        { id: 'student-grade', name: '年级', type: '单选', placeholder: '请选择年级', required: true, options: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'] },
        { id: 'student-class', name: '班级', type: '单选', placeholder: '请选择班级', required: true, options: ['1班', '2班', '3班', '4班'] },
        { id: 'student-birthday', name: '出生日期', type: '日期', placeholder: '请选择出生日期', required: false },
        { id: 'student-hobbies', name: '兴趣爱好', type: '多选', placeholder: '请选择兴趣爱好（可多选）', required: false, options: ['阅读', '运动', '音乐', '绘画'] }
      ]
    }
  ],
  forceRead: [
    {
      id: 'important',
      title: '重要提示',
      content: [
        '本产品由诚安达保险销售服务股份有限公司销售，承保公司以具体方案为准。',
        '投保前请仔细阅读保险条款，特别是责任免除部分。',
        '本产品保障期间为一年，到期后可续保。如有疑问，请联系保险顾问。'
      ]
    },
    {
      id: 'notice',
      title: '学平险投保须知',
      content: [
        '凡身体健康、能正常学习和生活的在校学生均可投保。',
        '请如实填写投保人与学生信息；保险责任、责任免除和理赔规则以正式保险条款为准。',
        '保单生效后按合同约定处理变更及退保，理赔时请提供真实、完整的证明材料。'
      ]
    }
  ],
  readRule: { mode: 'timer', seconds: 10 }
}

export const createDefaultSelections = (): SelectedPlanMap =>
  Object.fromEntries(productConfig.products.map((product) => [product.id, product.plans[0]?.id || null]))

export const getSelectedPlan = (product: ProductItem, selections: SelectedPlanMap) =>
  product.plans.find((plan) => plan.id === selections[product.id])

export const calculatePremium = (selections: SelectedPlanMap) =>
  productConfig.products.reduce((sum, product) => sum + (getSelectedPlan(product, selections)?.premium || 0), 0)
