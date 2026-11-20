import { apiRequest } from './api'
import type { ServerOrder } from './order'
import { orderFieldLabels, parseOrderDetail, type OrderFieldLabel } from './order-detail'

/** 历史字段标签缺失时，只补充当前产品的字段中文名称，不读取默认值或覆盖订单快照。 */
export async function fetchOrderFieldLabels(order: ServerOrder): Promise<OrderFieldLabel[]> {
  if (!parseOrderDetail(order).hasMissingLabels || order.productId == null) return []
  const productId = String(order.productId).trim()
  if (!productId || (typeof order.productId === 'number' && !Number.isSafeInteger(order.productId))) return []
  const product = await apiRequest<{ productId?: string | number; blockConfigList?: unknown }>(`/product/allInfo/${encodeURIComponent(productId)}`, 'GET')
  if (!product || String(product.productId) !== productId) return []
  return orderFieldLabels(product.blockConfigList)
}
