import Taro from '@tarojs/taro'
import { apiRequest, ApiResponse } from './api'

export type RefundRecord = { refundNo?: string; refundStatus?: string; refundAmount?: number | string; refundTime?: string; errorMsg?: string; remark?: string }
export type ServerOrder = {
  orderId?: string | number; orderNo: string; productId?: string | number
  productName?: string; productTitle?: string; totalAmount?: number | string; payAmount?: number | string; discountAmount?: number | string
  orderStatus?: string; payStatus?: string; policyStatus?: string; policyNo?: string
  policyEffectiveDate?: string; policyExpiryDate?: string; createTime?: string; payTime?: string
  orderData?: string; fieldData?: string | null; expireTime?: string; refundList?: RefundRecord[]
  pay?: { payChannel?: string; payChannelName?: string; payAmount?: number; payStatus?: string; payTime?: string }
}
export type PayChannel = { id: string | number; name?: string; code?: string; status?: string }
export type PayRequest = { amount: number; subject: string; productId?: string | number; orderId?: string | number; orderNo?: string; orderData?: string; channel: string; method: '4'; shareUser?: string }
export type PayResponse = { success?: boolean; orderId?: string | number; orderNo?: string; errorMsg?: string; timeStamp?: string; nonceStr?: string; packageStr?: string; signType?: string; paySign?: string }
export const message = (error: unknown) => error instanceof Error ? error.message : '请求失败，请稍后重试'
export function amountYuan(value: unknown): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) throw new Error('订单金额暂时无法确认，请刷新订单或联系客服')
  const amount = Number(value)
  if (!Number.isSafeInteger(Math.round(amount * 100))) throw new Error('金额超出有效范围')
  return amount
}
export const money = (value: unknown) => { try { return `¥${amountYuan(value).toFixed(2)}` } catch { return '待确认' } }
export type DictItem = { dictLabel: string; dictValue: string; status?: string }
const dictionaries: Record<string, DictItem[]> = {}
export async function fetchDictionary(type: string): Promise<DictItem[]> {
  const rows = await apiRequest<DictItem[]>(`/common/dict/data/type/${encodeURIComponent(type)}`, 'GET')
  if (!Array.isArray(rows) || rows.some(row => typeof row.dictLabel !== 'string' || typeof row.dictValue !== 'string')) throw new Error('字典返回格式异常，请重试')
  const enabled = rows.filter(row => row.status !== '1')
  dictionaries[type] = enabled
  return enabled
}
export async function loadOrderDictionaries() { await Promise.all(['pay_order_status', 'pay_status'].map(fetchDictionary)) }
const label = (type: string, value?: string) => dictionaries[type]?.find(row => row.dictValue === value)?.dictLabel
export const refundStatus = (value?: string) => label('pay_refund_status', value) || (value === 'SUCCESS' ? '退款成功' : `退款状态：${value || '未返回'}`)
const orderLabels: Record<string, string> = { NOTPAY: '待支付', PAID: '已支付', CANCELLED: '已取消', CLOSED: '已关闭', REFUNDING: '退款中', REFUNDED: '已退款' }
export const orderStateText = (order: ServerOrder) => label('pay_order_status', order.orderStatus) || orderLabels[order.orderStatus || ''] || order.orderStatus || '未返回'
export const payStateText = (order: ServerOrder) => label('pay_status', order.payStatus) || ({ NOTPAY: '未支付', SUCCESS: '支付成功', REFUNDING: '退款中', REFUNDED: '已退款', CLOSED: '已关闭' } as Record<string, string>)[order.payStatus || ''] || order.payStatus || '未返回'
export const orderStatus = (order: ServerOrder) => `订单状态：${orderStateText(order)}；支付状态：${payStateText(order)}`
const segment = (value: string | number) => { if (!String(value).trim()) throw new Error('订单标识缺失'); return encodeURIComponent(String(value)) }
export async function fetchOrder(orderNo: string): Promise<ServerOrder> {
  const order = await apiRequest<ServerOrder>(`/order/getOrderByOrderNo/${segment(orderNo)}`, 'GET')
  if (!order || order.orderNo !== orderNo) throw new Error('订单返回数据异常')
  return order
}
export async function fetchOrderById(id: string): Promise<ServerOrder> {
  const order = await apiRequest<ServerOrder>(`/order/${segment(id)}`, 'GET')
  if (!order?.orderNo || String(order.orderId) !== id) throw new Error('订单返回数据异常')
  return order
}
export async function fetchOrders(pageNum = 1, orderNo = ''): Promise<{ rows: ServerOrder[]; total: number }> {
  const result = await apiRequest<{ rows: ServerOrder[]; total: number }>('/order/list', 'GET', { pageNum, pageSize: 20, ...(orderNo.trim() ? { orderNo: orderNo.trim() } : {}) }, 'raw')
  if (!Array.isArray(result.rows) || !Number.isFinite(Number(result.total)) || result.rows.some(order => !order?.orderNo)) throw new Error('订单列表返回数据异常')
  return { rows: result.rows, total: Number(result.total) }
}
export async function fetchChannels(productId: string | number): Promise<PayChannel[]> {
  const channels = await apiRequest<PayChannel[]>(`/pay/channelList/${segment(productId)}`, 'GET', { status: '0' }, 'raw')
  if (!Array.isArray(channels)) throw new Error('支付渠道返回数据异常')
  return channels.filter(item => item.id != null && item.status === '0')
}
export async function cancelOrder(orderNo: string): Promise<void> {
  await apiRequest(`/pay/cancelOrder/${segment(orderNo)}`, 'GET')
}
export async function applyRefund(order: ServerOrder, refundReason: string, remark: string): Promise<void> {
  if (order.orderStatus !== 'PAID' || !refundReason.trim()) throw new Error('仅已支付订单可退款，且必须选择退款原因')
  const result = await apiRequest<{ success?: boolean; errorMsg?: string }>('/pay/applyRefund', 'POST', { orderNo: order.orderNo, refundAmount: amountYuan(order.payAmount), refundReason, remark, refundChannel: 1 })
  if (result?.success !== true) throw new Error(result?.errorMsg || '退款申请结果未确认，请查询订单后再操作')
}
export function paymentParameters(result: PayResponse) {
  if (!result || result.success !== true || !result.orderNo) throw new Error(result?.errorMsg || '预支付结果未确认，请先查看订单，勿重复提交')
  if (![result.timeStamp, result.nonceStr, result.packageStr, result.paySign].every(value => typeof value === 'string' && value.trim()) || !['RSA', 'MD5', 'HMAC-SHA256'].includes(result.signType || '')) throw new Error('支付参数不完整，请查询订单后再操作')
  return { timeStamp: result.timeStamp!, nonceStr: result.nonceStr!, package: result.packageStr!, signType: result.signType as 'RSA' | 'MD5' | 'HMAC-SHA256', paySign: result.paySign! }
}
export async function prepay(request: PayRequest, confirmWarning: (text: string) => Promise<boolean>, isActive: () => boolean = () => true, beforeDispatch: () => void = () => {}): Promise<PayResponse | null> {
  if (!isActive()) return null
  if (!Number.isFinite(request.amount) || request.amount < 0 || !request.subject.trim() || !request.channel) throw new Error('支付金额、主题或渠道缺失')
  const validation = await apiRequest<ApiResponse<unknown>>('/pay/validBeforePay', 'POST', request, 'validation')
  if (!isActive()) return null
  if (typeof validation.code !== 'number') throw new Error('支付校验响应异常')
  if (validation.code !== 200) throw new Error(validation.msg || '支付校验未通过，请稍后重试')
  if (validation.msg?.trim()) {
    const confirmed = await confirmWarning(validation.msg)
    if (!isActive() || !confirmed) return null
  }
  if (!isActive()) return null
  beforeDispatch()
  return apiRequest<PayResponse>('/pay/prepay', 'POST', request)
}
export async function invokePayment(result: PayResponse): Promise<'cancelled' | 'submitted' | 'unknown'> {
  const parameters = paymentParameters(result)
  try { await Taro.requestPayment(parameters); return 'submitted' } catch (error) {
    return /cancel/i.test(String((error as { errMsg?: string })?.errMsg || '')) ? 'cancelled' : 'unknown'
  }
}
