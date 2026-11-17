import Taro from '@tarojs/taro'
import { getAuthSession } from './session'
import type { ServerOrder } from './order'

export type OrderAction = 'pay' | 'cancel' | 'refund'
export const CONTRACT_BLOCK_REASON = '订单状态规则待服务方确认，暂不能执行该操作'
export function orderActionBlockReason(order: ServerOrder, action: OrderAction): string {
  if (action === 'cancel') return '本期不支持手动取消，未支付订单由服务端自动关闭'
  if (action === 'pay') return order.orderStatus === 'NOTPAY' ? '' : '仅待支付订单可继续支付，请刷新订单状态'
  return order.orderStatus === 'PAID' ? '' : '仅已支付订单可申请退款，请刷新订单状态'
}
const inFlight = new Set<string>()
const PENDING_REASON = '该操作已提交或结果待确认，请刷新订单或联系客服核实，暂不能重复提交'
function pendingKey(orderNo: string, action: OrderAction): string {
  const userId = getAuthSession()?.userId
  if (!userId || !orderNo.trim()) throw new Error('登录用户或订单标识缺失，暂不能执行该操作')
  return `insurance-order-pending:v1:${encodeURIComponent(userId)}:${encodeURIComponent(orderNo)}:${action}`
}
export function pendingBlockReason(orderNo: string, action: OrderAction): string {
  if (action === 'pay') {
    try { pendingKey(orderNo, action); return '' } catch { return '请先登录后支付' }
  } // Known orderNo can safely reuse the payment order, including legacy pending entries.
  try { return Taro.getStorageSync(pendingKey(orderNo, action)) ? PENDING_REASON : '' }
  catch { return '无法确认本地操作记录或登录身份，暂不能执行该操作' }
}
/** Persist BEFORE dispatch. Legacy records remain blocked until server evidence resolves them. */
export function beginOrderAction(orderNo: string, action: OrderAction): () => void {
  const key = pendingKey(orderNo, action)
  if (Taro.getStorageSync(key)) throw new Error(PENDING_REASON)
  Taro.setStorageSync(key, { pending: true, version: 2 })
  if (!Taro.getStorageSync(key)) throw new Error('无法保存操作记录，已停止提交')
  inFlight.add(key)
  return () => { inFlight.delete(key) }
}

/** Only a fresh authoritative response can release a v2 refund retry. Legacy unknown writes stay closed. */
export function reconcileRefund(order: ServerOrder): void {
  const key = pendingKey(order.orderNo, 'refund')
  const pending = Taro.getStorageSync(key)
  if (!pending || inFlight.has(key)) return
  if (order.orderStatus !== 'PAID' || order.refundList?.length) {
    Taro.setStorageSync(key, null)
  } else if (pending.version === 2) {
    // Backend instructs refreshing after timeout; a fresh PAID/no-record response permits manual retry.
    Taro.setStorageSync(key, null)
  }
}

/** Captured generations stay invalid after unload, even if a later mount starts. */
export function createLifecycleGuard() {
  let generation = 0
  let active = true
  return {
    activate() { if (!active) { generation++; active = true } },
    dispose() { generation++; active = false },
    capture() {
      const ticket = generation
      const session = getAuthSession()
      return () => active && ticket === generation && getAuthSession()?.userId === session?.userId && getAuthSession()?.token === session?.token
    }
  }
}
