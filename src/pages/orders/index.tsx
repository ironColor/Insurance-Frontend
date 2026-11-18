import { Button, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { fetchOrders, loadOrderDictionaries, message, money, ServerOrder } from '../../services/order'
import { useOrderLifecycle } from '../../hooks/use-order-lifecycle'
import './index.css'

const statusLabels: Record<string, { label: string; tone: string }> = {
  NOTPAY: { label: '待支付', tone: 'pending' },
  PAID: { label: '已支付', tone: 'paid' },
  REFUNDING: { label: '退款中', tone: 'pending' },
  REFUNDED: { label: '已退款', tone: 'neutral' },
  CANCELLED: { label: '已取消', tone: 'neutral' },
  CLOSED: { label: '已关闭', tone: 'neutral' }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<ServerOrder[]>([])
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [failedPage, setFailedPage] = useState(1)
  const sequence = useRef(0)
  const inFlight = useRef(false)
  const submittedKeyword = useRef('')
  const lifecycle = useOrderLifecycle()
  const load = async (next = 1) => {
    const alive = lifecycle.capture()
    if (!alive()) return
    const ticket = ++sequence.current
    const isActive = () => alive() && ticket === sequence.current
    inFlight.current = true
    setLoading(true)
    setError('')
    if (next === 1) {
      setOrders([])
      setTotal(0)
      setPage(1)
    }
    try {
      const result = await fetchOrders(next, submittedKeyword.current)
      await loadOrderDictionaries().catch(() => {})
      if (!isActive()) return
      setOrders(previous => next === 1 ? result.rows : [...previous, ...result.rows])
      setTotal(result.total)
      setPage(next)
    } catch (error) {
      if (isActive()) { setError(message(error)); setFailedPage(next) }
    } finally {
      if (ticket === sequence.current) inFlight.current = false
      if (isActive()) setLoading(false)
    }
  }
  const search = () => {
    if (inFlight.current) return
    submittedKeyword.current = keyword.trim()
    void load()
  }
  const showAll = () => {
    if (inFlight.current) return
    setKeyword('')
    submittedKeyword.current = ''
    void load()
  }
  const retry = () => { if (!inFlight.current) void load(failedPage) }
  const loadMore = () => { if (!inFlight.current) void load(page + 1) }
  const isSearch = Boolean(submittedKeyword.current)
  useDidShow(() => { void load() })

  return <View className='orders-page'>
    <View className='orders-heading'>
      <Text className='orders-heading-title'>我的订单</Text>
      <Text className='orders-heading-caption'>投保记录，随时查看</Text>
    </View>
    <View className='orders-search'>
      <View className='orders-search-field'>
        <View className='orders-search-icon' />
        <Input className='orders-search-input' placeholderClass='orders-search-placeholder' placeholder='输入订单号查询' value={keyword} confirmType='search' onConfirm={search} onInput={event => setKeyword(event.detail.value)} />
        {keyword && <Button className='orders-search-clear' ariaLabel='清空订单号' onClick={() => setKeyword('')}>×</Button>}
      </View>
      <Button className='orders-search-button' hoverClass='orders-button-hover' disabled={loading} onClick={search}>{loading ? '查询中' : '查询'}</Button>
    </View>

    {!orders.length ? <View className='orders-state'>
      {loading ? <>
        <View className='orders-state-symbol'><View className='orders-spinner' /></View>
        <Text className='orders-state-title'>正在查询订单</Text>
        <Text className='orders-state-description'>请稍候，正在获取最新订单信息</Text>
      </> : error ? <>
        <View className='orders-state-symbol orders-state-symbol-error'><Text className='orders-error-mark'>!</Text></View>
        <Text className='orders-state-title'>订单暂时无法加载</Text>
        <Text className='orders-state-description'>{error}</Text>
        <Button className='orders-state-button' hoverClass='orders-button-hover' onClick={retry}>重新加载</Button>
      </> : <>
        <View className='orders-state-symbol'>
          <View className='orders-document'><View className='orders-document-line' /><View className='orders-document-line' /><View className='orders-document-line orders-document-line-short' /></View>
          <View className='orders-document-badge'><View className='orders-search-icon' /></View>
        </View>
        <Text className='orders-state-title'>{isSearch ? '未找到相关订单' : '暂无订单'}</Text>
        <Text className='orders-state-description'>{isSearch ? '请检查订单号是否正确，或查看全部订单' : '投保后，您可以在这里查看订单和支付进度'}</Text>
        <Button className='orders-state-button' hoverClass='orders-button-hover' onClick={isSearch ? showAll : () => Taro.redirectTo({ url: '/pages/home/index' })}>{isSearch ? '查看全部订单' : '去看看产品'}</Button>
      </>}
    </View> : <View className='orders-list'>
      <View className='orders-list-heading'><Text>{isSearch ? '查询结果' : '全部订单'}</Text><Text className='orders-list-count'>共 {total} 笔</Text></View>
      {orders.map(order => {
        const status = statusLabels[order.orderStatus || ''] || { label: '状态待确认', tone: 'neutral' }
        return <View className='order-card' key={order.orderNo}>
          <View className='order-card-head'>
            <View className='order-number'><Text className='order-number-label'>订单号</Text><Text className='order-number-value' selectable>{order.orderNo}</Text></View>
            <Text className={`order-status order-status-${status.tone}`}>{status.label}</Text>
          </View>
          <View className='order-product-row'>
            <View className='order-product-icon'><View className='order-product-sheet'><View /><View /></View></View>
            <View className='order-product-info'><Text className='order-product'>{order.productName || order.productTitle || '保险订单'}</Text><Text className='order-time'>下单时间：{order.createTime || '—'}</Text></View>
          </View>
          <View className='order-card-foot'>
            <View className='order-amount'><Text className='order-amount-label'>订单金额</Text><Text className='order-price'>{money(order.totalAmount)}</Text></View>
            <Button className='order-action' hoverClass='orders-button-hover' onClick={() => Taro.navigateTo({ url: `/pages/order-detail/index?orderNo=${encodeURIComponent(order.orderNo)}` })}>查看详情</Button>
          </View>
        </View>
      })}
      <View className='orders-list-footer'>
        {loading ? <View className='orders-more-loading'><View className='orders-spinner orders-spinner-small' /><Text>正在加载更多</Text></View>
          : error ? <><Text className='orders-footer-error'>{error}</Text><Button className='orders-more-button' onClick={retry}>重新加载</Button></>
          : orders.length < total ? <Button className='orders-more-button' hoverClass='orders-button-hover' onClick={loadMore}>加载更多订单</Button>
          : <Text className='orders-end'>已显示全部订单</Text>}
      </View>
    </View>}
  </View>
}
