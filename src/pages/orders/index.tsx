import { Button, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { fetchOrders, loadOrderDictionaries, message, money, orderStatus, ServerOrder } from '../../services/order'
import { useOrderLifecycle } from '../../hooks/use-order-lifecycle'
import './index.css'

export default function OrdersPage() {
  const [orders, setOrders] = useState<ServerOrder[]>([])
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const sequence = useRef(0)
  const submittedKeyword = useRef('')
  const lifecycle = useOrderLifecycle()
  const load = async (next = 1) => {
    const alive = lifecycle.capture()
    if (!alive()) return
    const ticket = ++sequence.current
    const isActive = () => alive() && ticket === sequence.current
    setLoading(true); setError('')
    if (next === 1) setOrders([])
    try {
      const result = await fetchOrders(next, submittedKeyword.current)
      await loadOrderDictionaries().catch(() => {})
      if (!isActive()) return
      setOrders(previous => next === 1 ? result.rows : [...previous, ...result.rows]); setTotal(result.total); setPage(next)
    } catch (error) { if (isActive()) setError(message(error)) }
    finally { if (isActive()) setLoading(false) }
  }
  useDidShow(() => { void load() })
  return <View className='orders-page'>
    <View className='orders-search'><Input placeholder='按订单号查询' value={keyword} onInput={event => setKeyword(event.detail.value)} /><Button disabled={loading} onClick={() => { submittedKeyword.current = keyword.trim(); void load() }}>查询</Button></View>
    {error && <View>{error}<Button disabled={loading} onClick={() => load()}>重试</Button></View>}
    {!loading && !error && !orders.length && <View className='orders-empty'>暂无订单</View>}
    {orders.map(order => <View className='order-card' key={order.orderNo}>
      <View className='order-card-head'>订单号 {order.orderNo}</View>
      <Text className='order-product'>{order.productName || order.productTitle || '保险订单'}</Text>
      <View>{orderStatus(order)}</View><View>{order.createTime}</View>
      <View className='order-card-foot'><Text>{money(order.totalAmount)}</Text><Button onClick={() => Taro.navigateTo({ url: `/pages/order-detail/index?orderNo=${encodeURIComponent(order.orderNo)}` })}>查看详情</Button></View>
    </View>)}
    {loading && <View>正在查询订单…</View>}
    {orders.length < total && <Button disabled={loading} onClick={() => load(page + 1)}>加载更多</Button>}
  </View>
}
