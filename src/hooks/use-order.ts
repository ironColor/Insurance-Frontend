import { useRef, useState } from 'react'
import { useDidHide, useDidShow, useUnload, useRouter } from '@tarojs/taro'
import { fetchOrder, fetchOrderById, loadOrderDictionaries, message, ServerOrder } from '../services/order'
import { reconcileRefund } from '../services/order-safety'
import { useOrderLifecycle } from './use-order-lifecycle'
import { fetchOrderFieldLabels } from '../services/order-field-labels'
import type { OrderFieldLabel } from '../services/order-detail'

export function useOrder({ includeFieldLabels = false } = {}) {
  const params = useRouter().params
  const [order, setOrder] = useState<ServerOrder | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldLabels, setFieldLabels] = useState<OrderFieldLabel[]>([])
  const sequence = useRef(0)
  const loadedFor = useRef<() => boolean>(() => false)
  const lifecycle = useOrderLifecycle()
  const reload = async () => {
    const alive = lifecycle.capture()
    if (!alive()) return
    const current = ++sequence.current
    const isActive = () => alive() && current === sequence.current
    loadedFor.current = () => false
    setLoading(true); setError(''); setOrder(null); setFieldLabels([])
    try {
      const result = params.orderNo ? await fetchOrder(params.orderNo) : params.id ? await fetchOrderById(params.id) : null
      if (!result) throw new Error('缺少服务端订单标识，请从我的订单重新进入')
      await loadOrderDictionaries().catch(() => {}) // Raw codes and known labels remain available offline.
      if (isActive()) { reconcileRefund(result); loadedFor.current = alive; setOrder(result) }
      if (includeFieldLabels && isActive()) {
        const labels = await fetchOrderFieldLabels(result).catch(() => [])
        if (isActive()) setFieldLabels(labels)
      }
    } catch (error) { if (isActive()) setError(message(error)) }
    finally { if (isActive()) setLoading(false) }
  }
  useDidShow(() => { void reload() })
  useDidHide(() => { sequence.current++ })
  useUnload(() => { sequence.current++ })
  return { order, error, loading, reload, fieldLabels, isCurrent: () => loadedFor.current() }
}
