import userServiceHtml from '../assets/agreements/user-service.html?raw'
import privacyPolicyHtml from '../assets/agreements/privacy-policy.html?raw'
import type { ProductDocument } from './product-types'

// 仅在介绍页没有可见后台协议时展示，不写入产品配置、投保草稿或订单。
export const defaultProductAgreements: readonly ProductDocument[] = [
  { id: 'default-user-service', title: '用户服务协议', contentType: 'text', content: [userServiceHtml] },
  { id: 'default-privacy-policy', title: '隐私政策', contentType: 'text', content: [privacyPolicyHtml] }
]
