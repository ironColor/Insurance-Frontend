import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'

import { getSelectedPlan, INSURANCE_ORDERS_KEY, OrderRecord, productConfig } from '../../services/product'

import './index.css'

type Filter = '全部' | OrderRecord['status']

const statusClassMap: Record<OrderRecord['status'], string> = {
  待支付: 'status-pending',
  已支付: 'status-paid',
  支付失败: 'status-failed'
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [filter, setFilter] = useState<Filter>('全部')
  useDidShow(() => setOrders(Taro.getStorageSync<OrderRecord[]>(INSURANCE_ORDERS_KEY) || []))
  const filteredOrders = useMemo(() => filter === '全部' ? orders : orders.filter((order) => order.status === filter), [filter, orders])

  return (
    <View className='orders-page'>
      <View className='order-tabs'>
        {(['全部', '待支付', '已支付', '支付失败'] as Filter[]).map((item) => (
          <View className={`order-tab ${filter === item ? 'order-tab-active' : ''}`} key={item} onClick={() => setFilter(item)}>{item}</View>
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
                <View className='order-card-head'><Text className='order-number'>订单号 {order.id}</Text><Text className={`order-status ${statusClassMap[order.status]}`}>{order.status}</Text></View>
                <Text className='order-product'>{plans.join(' + ')}</Text>
                <View className='order-meta'><Text>被保险人：{order.formValues['student-name'] || '-'}</Text><Text>{order.createdAt}</Text></View>
                <View className='order-card-foot'>
                  <View><Text className='order-count'>共 {plans.length} 项，实付 </Text><Text className='order-price'>¥{order.totalPremium.toFixed(2)}</Text></View>
                  <Button className='order-action' onClick={() => Taro.showModal({ title: '订单详情', content: `订单编号：${order.id}\n当前状态：${order.status}\n保障方案：${plans.join('、')}`, showCancel: false })}>查看详情</Button>
                </View>
              </View>
            )
          })}
        </View>
      ) : (
        <View className='orders-empty'>
          <View className='empty-document'>▤</View>
          <Text className='empty-title'>暂无{filter === '全部' ? '' : filter}订单</Text>
          <Text className='empty-description'>选择适合孩子的保障方案，完成投保后可在这里查看订单。</Text>
          <Button className='empty-button' onClick={() => Taro.navigateTo({ url: '/pages/index/index' })}>去选择产品</Button>
        </View>
      )}
    </View>
  )
}
