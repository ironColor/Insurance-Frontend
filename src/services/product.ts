import { ApiError, apiRequest } from './api'
import { ProductUnavailableError, normalizeProductConfig, normalizeProductId, normalizeProductScene } from './product-normalize'
import type { ProductConfig } from './product-types'

export type * from './product-types'
export { calculatePremium, createDefaultSelections, getSelectedPlan, isProductConfigSnapshot, ProductUnavailableError } from './product-normalize'

export const INSURANCE_DRAFT_KEY = 'insurance-order-draft'
export const INSURANCE_ORDERS_KEY = 'insurance-orders'

export async function fetchProductConfig(productId: string): Promise<ProductConfig> {
  const id = normalizeProductId(productId)
  try {
    const response = await apiRequest<unknown>(`/product/allInfo/${encodeURIComponent(id)}`, 'GET')
    return normalizeProductConfig(response, id)
  } catch (error) {
    if (error instanceof ApiError && (error.code === 404 || error.statusCode === 404)) throw new ProductUnavailableError()
    throw error
  }
}

export async function decodeProductScene(scene: string): Promise<{ productId: string; shareUser?: string }> {
  if (!scene.trim()) throw new Error('产品码参数缺失，请重新扫码')
  try {
    const response = await apiRequest<unknown>(`/product/decodeScene/${encodeURIComponent(scene)}`, 'GET')
    return normalizeProductScene(response)
  } catch (error) {
    if (error instanceof ApiError && (error.code === 404 || error.statusCode === 404)) throw new ProductUnavailableError('该产品码已失效，请联系分享人重新获取')
    throw error
  }
}
