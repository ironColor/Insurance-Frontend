import { Button, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'

import { getSelectedPlan, INSURANCE_ORDERS_KEY, OrderRecord, productConfig } from '../../services/product'

import './index.css'

type Filter = '全部' | OrderRecord['status']

const statusClassMap: Record<OrderRecord['status'], string> = {
  待支付: 'status-pending',
  已支付: 'status-paid',
  支付失败: 'status-failed',
  退款中: 'status-pending',
  退款完成: 'status-paid'
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [filter, setFilter] = useState<Filter>('全部')
  const [keyword, setKeyword] = useState('')
  useDidShow(() => setOrders(Taro.getStorageSync<OrderRecord[]>(INSURANCE_ORDERS_KEY) || []))
  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesStatus = filter === '全部' || order.status === filter
    const matchesKeyword = !keyword.trim() || order.id.includes(keyword.trim()) || (order.formValues['student-name'] || '').includes(keyword.trim())
    return matchesStatus && matchesKeyword
  }), [filter, keyword, orders])

  return (
    <View className='orders-page'>
      <View className='orders-search'><Text>⌕</Text><Input placeholder='搜索订单号或学生姓名' value={keyword} onInput={(event) => setKeyword(event.detail.value)} /></View>
      <View className='order-tabs'>
        {(['全部', '待支付', '已支付', '支付失败', '退款中', '退款完成'] as Filter[]).map((item) => (
          <View className={`order-tab ${filter === item ? 'order-tab-active' : ''}`} key={item} onClick={() => setFilter(item)}>{item === '已支付' ? '支付成功' : item}</View>
        ))}
      </View>
      {filteredOrders.length ? (
        <View className='orders-list'>
          {filteredOrders.map((order) => {
            const plans = productConfig.products.flatMap((product) => {
              const plan = getSelectedPlan(product, order.selectedPlans)
              return plan ? [`${product.name}·${plan.name}`] : []
            })
            return (
              <View className='order-card' key={order.id}>
                <View className='order-card-head'><Text className='order-number'>订单号 {order.id}</Text><Text className={`order-status ${statusClassMap[order.status]}`}>{order.status === '已支付' ? '支付成功' : order.status}</Text></View>
                <Text className='order-product'>{plans.join(' + ')}</Text>
                <View className='order-meta'><Text>被保险人：{order.formValues['student-name'] || '-'}</Text><Text>{order.createdAt}</Text></View>
                <View className='order-card-foot'>
                  <View><Text className='order-count'>共 {plans.length} 项，保费 </Text><Text className='order-price'>¥{order.totalPremium.toFixed(2)}</Text></View>
                  <Button className='order-action' onClick={() => Taro.navigateTo({ url: `/pages/order-detail/index?id=${encodeURIComponent(order.id)}` })}>查看详情</Button>
                </View>
              </View>
            )
          })}
        </View>
      ) : (
        <View className='orders-empty'>
          <View className='empty-document'>▤</View>
          <Text className='empty-title'>{keyword ? '未找到相关订单' : `暂无${filter === '全部' ? '' : filter}订单`}</Text>
          <Text className='empty-description'>选择适合孩子的保障方案，完成投保后可在这里查看订单。</Text>
          <Button className='empty-button' onClick={() => Taro.navigateTo({ url: '/pages/index/index' })}>去选择产品</Button>
        </View>
      )}
    </View>
  )
}
